# Brand Logo & Hero Image dimension guidance

**Date:** 2026-07-29
**Repo:** `branding-prismscale-form`
**Status:** approved, ready for implementation planning

## Problem

`FileUpload` (`src/components/FileUpload.tsx`) is used at 28 call sites and performs no
validation of any kind. Files go straight to S3 through a presigned URL
(`api/upload-url.ts`), and there is no server-side image processing anywhere in
the pipeline. Nothing tells a client what dimensions to supply, and nothing
notices when they supply something unsuitable.

Two fields carry real consequences, because the renderer sizes them rigidly:

| Field | Rendered by | How it fails |
|---|---|---|
| `brand_hero_image_url` | `hero.html:10` — `object-cover w-full h-full`, full-viewport container | Always fills, so the failure is quality, not fit: a low-resolution file is upscaled to ~1920×1080 and looks soft; a portrait or square file has its subject cropped away. |
| `brand_logo_url` | `hero.html:47` — `h-28 md:h-40 w-auto object-contain` | Height-locked at 160px on desktop. A very wide lockup stretches out and crowds the title; an opaque-background file shows a visible box against the dark hero; a small raster is upscaled and blurs. |

## Decisions

1. **Warn, but never block.** Off-spec uploads are accepted. A client with a
   slightly-wrong export must always be able to finish the form; the warning
   exists so the problem is visible during UAT, not so the form can refuse work.
2. **Scope is the two hero fields only.** Logo variants, favicons, illustration
   and image tiles, and collaterals are unchanged. Tiles sit in flexible grids
   where exact dimensions barely matter.
3. **Specs are the derived values in the table below**, calculated from the
   render sizes and doubled for retina.
4. **Warnings persist.** They are recomputed whenever a URL is present, so
   resuming a draft or loading a saved client re-surfaces them.

## Non-goals

- No resizing, re-encoding, cropping, or any other mutation of client assets.
- No blocking of form submission, and no new validation errors.
- No changes to `api/upload-url.ts`, to S3 configuration, or to the renderer.
- No spec on the 26 remaining upload fields.

## Architecture

Three units, each independently understandable.

### 1. `src/lib/imageSpec.ts` — spec data and rule evaluation

Pure module, no React, no I/O.

```ts
export type ImageSpec = {
  hint: string;            // shown under the button before upload
  minWidth?: number;
  minHeight?: number;
  aspect?: { ratio: number; tolerance: number };  // ratio = w / h
  maxAspect?: number;      // warn when w/h exceeds this
  rejectPortrait?: boolean;
  preferTransparent?: boolean;
};

export function evaluateSpec(
  dims: { width: number; height: number },
  url: string,
  spec: ImageSpec,
): string[];   // human-readable warnings; empty array means the asset is fine
```

`evaluateSpec` is a pure function of its inputs. That keeps it directly
unit-testable if a runner is added later (see Verification).

**Rule ordering matters.** Portrait is a special case of an aspect miss, so when
`rejectPortrait` fires, the generic aspect rule is skipped. Otherwise a portrait
hero would produce two warnings describing the same defect.

### 2. `src/lib/useImageSpec.ts` — measurement hook

```ts
useImageSpec(url: string | undefined, spec: ImageSpec | undefined):
  { status: 'idle' | 'checking' | 'ok' | 'warn'; messages: string[] }
```

Measures **only from the resolved S3 URL**, never from a `File`. The upload
completes before `onUploadComplete` fires, so a fresh upload and a restored
draft are the same case and share one code path — which is also what makes
decision 4 free rather than extra work.

Loads the URL via `new Image()` and reads `naturalWidth` / `naturalHeight`.
This works cross-origin without CORS headers; only canvas *pixel* reads are
restricted. **No S3 bucket changes are required.**

Cancels on unmount and on URL change, so a fast re-upload cannot land a stale
result over a newer one. A load failure resolves to `idle` — never a warning,
because a failure to measure is not evidence of a bad asset.

### 3. `FileUpload` — presentation

Gains one optional prop, `spec?: ImageSpec`. When absent the component behaves
exactly as it does today, which is why the 26 remaining call sites need no edit.

- Before upload: `spec.hint` in small grey text beneath the Select File button.
- After upload: the existing filename chip, unchanged, plus an amber warning
  block listing `messages` when `status === 'warn'`.

The amber block reuses the treatment already established by the draft banner at
`App.tsx:1675` (`border-amber-200 bg-amber-50 text-amber-800`), so this
introduces no new visual vocabulary.

### Wiring

`src/App.tsx`, two lines: `spec={LOGO_SPEC}` on the Brand Logo field (`:986`)
and `spec={HERO_SPEC}` on the Brand Hero Image field (`:1000`).

## Spec values

### `HERO_SPEC`

- Hint: `Recommended 1920 × 1080 (16:9 landscape)`
- Warn when width < 1600
- Warn when portrait (height > width) — suppresses the aspect rule
- Warn when aspect is outside 16:9 ±15%, i.e. below 1.511 or above 2.044

### `LOGO_SPEC`

- Hint: `Recommended 800 × 320, transparent PNG or SVG`
- Warn when height < 320 (renders at 160px, doubled for retina)
- Warn when aspect ratio exceeds 4:1
- Warn when the URL extension is `.jpg` / `.jpeg`, since JPEG cannot carry
  transparency and will show a box against the dark hero

SVG uploads report meaningful `naturalWidth` / `naturalHeight` only when the
file declares intrinsic dimensions. When both read as 0, treat the asset as
`ok`: SVG is vector and resolution-independent, so dimension rules do not apply.

### Message wording

Each message states the measurement, the target, and the consequence — the
consequence is the part that makes the warning actionable:

> Only 900px wide — recommended 1920 × 1080. This will look soft full-screen.

> Logo is 6.2:1 — wider than the 4:1 the hero layout expects, so it will crowd
> the title.

> JPEG can't store transparency, so this will show a solid box against the dark
> hero. Export as PNG or SVG.

## Error handling

| Case | Behaviour |
|---|---|
| Image fails to load | `idle`, no warning |
| URL cleared by the user | State resets, warning disappears |
| URL replaced mid-measurement | Prior measurement discarded |
| `spec` prop absent | Hook inert, component behaves as today |
| Non-image upload (PDF) | No spec passed on those fields, so unreachable |

## Verification

The project has no test runner — `npm run lint` is `tsc --noEmit`, alongside
`npm run build`. Verification is therefore:

1. `npm run lint` and `npm run build` both clean.
2. Manual browser check against prepared fixtures, confirming each rule fires:
   an 800×600 hero (too small, wrong aspect), a portrait hero (portrait message
   only, *not* two messages), a 1920×1080 hero (silent), a 120px-tall logo, a
   1200×150 logo (8:1), a `.jpg` logo, and a clean 800×320 transparent PNG.
3. Reload the page with a saved draft and confirm warnings reappear — this is
   the behaviour decision 4 asks for and the one most easily broken.
4. Confirm the 26 remaining upload fields render unchanged.

`evaluateSpec` being pure means step 2 could later be replaced by unit tests
without restructuring. Adding a runner is out of scope here.

## Assumptions

- Hint text is added to the two specced fields only. A generic "PNG/SVG
  preferred" line on all uploads was raised but not adopted, as it falls outside
  the agreed scope.
- S3 keys preserve the original filename, so the URL extension is a reliable
  signal for the JPEG check.
