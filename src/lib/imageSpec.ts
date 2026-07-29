export type Dimensions = { width: number; height: number };

/** A threshold paired with the consequence of missing it. */
type Rule<T> = T & { consequence: string };

export type ImageSpec = {
  /** Shown under the Select File button before anything is uploaded. */
  hint: string;
  /** Target dimensions, quoted back inside warning messages. */
  recommended: string;
  minWidth?: Rule<{ px: number }>;
  minHeight?: Rule<{ px: number }>;
  aspect?: Rule<{ ratio: number; label: string; tolerance: number }>;
  maxAspect?: Rule<{ ratio: number }>;
  rejectPortrait?: Rule<object>;
  rejectJpeg?: Rule<object>;
  /** Byte ceiling. `label` is the human form quoted back in the message. */
  maxBytes?: Rule<{ bytes: number; label: string }>;
};

export const HERO_SPEC: ImageSpec = {
  hint: "Recommended 1920 × 1080 (16:9 landscape), max 2 MB",
  recommended: "1920 × 1080",
  minWidth: {
    px: 1600,
    consequence: "This will look soft full-screen.",
  },
  maxBytes: {
    bytes: 2 * 1024 * 1024,
    label: "2 MB",
    consequence:
      "A file this large would make the published page slow to load, especially on mobile. Compress it and try again.",
  },
  rejectPortrait: {
    consequence:
      "The hero is a wide landscape banner, so the top and bottom will be cropped away.",
  },
  aspect: {
    ratio: 16 / 9,
    label: "16:9",
    tolerance: 0.15,
    consequence: "The edges will be cropped to fill the screen.",
  },
};

export const LOGO_SPEC: ImageSpec = {
  hint: "Recommended 800 × 320, transparent PNG or SVG, max 500 KB",
  recommended: "800 × 320",
  minHeight: {
    px: 320,
    consequence: "It renders 160px tall, so this will look soft on retina screens.",
  },
  maxBytes: {
    bytes: 500 * 1024,
    label: "500 KB",
    consequence:
      "A logo this large usually means a raster image is embedded — export an optimised PNG or an SVG and try again.",
  },
  maxAspect: {
    ratio: 4,
    consequence: "It will crowd the title beneath it.",
  },
  rejectJpeg: {
    consequence:
      "This will show a solid box against the dark hero. Export as PNG or SVG.",
  },
};

const JPEG_EXTENSION = /\.jpe?g(?:$|\?)/i;
const SVG_EXTENSION = /\.svg(?:$|\?)/i;

function formatRatio(ratio: number): string {
  // Whole numbers read as "4:1", not "4.0:1".
  return Number.isInteger(ratio) ? `${ratio}:1` : `${ratio.toFixed(1)}:1`;
}

function formatBytes(bytes: number): string {
  // Round UP, never down. This message only appears when the file exceeds the
  // limit, so rounding down can print "This file is 2.0 MB — recommended under
  // 2 MB", which contradicts itself. Ceiling keeps the stated size strictly
  // above the quoted threshold at the cost of overstating by <1 KB / <0.1 MB.
  const mb = 1024 * 1024;
  return bytes >= mb
    ? `${(Math.ceil((bytes / mb) * 10) / 10).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
}

/**
 * Pure. Byte-size rule, kept separate from `evaluateSpec` because size is known
 * at file-selection time while dimensions are measured later from the uploaded
 * URL. Returns an empty array when the file is within budget or has no rule.
 *
 * Unlike the dimension rules this one is ENFORCED: a non-empty result means the
 * caller must skip the upload entirely, so the message says the file was not
 * uploaded and tells the user what to do about it.
 */
export function evaluateSize(bytes: number, spec: ImageSpec): string[] {
  if (!spec.maxBytes || bytes <= spec.maxBytes.bytes) return [];
  return [
    `Not uploaded — this file is ${formatBytes(bytes)}, over the ${spec.maxBytes.label} limit. ${spec.maxBytes.consequence}`,
  ];
}

/**
 * Pure. Returns human-readable warnings; an empty array means the asset is fine.
 * Each message states the measurement, the target, and the consequence.
 */
export function evaluateSpec(
  dims: Dimensions,
  url: string,
  spec: ImageSpec,
): string[] {
  const messages: string[] = [];
  const { width, height } = dims;

  if (spec.rejectJpeg && JPEG_EXTENSION.test(url)) {
    messages.push(`JPEG can't store transparency. ${spec.rejectJpeg.consequence}`);
  }

  // A genuinely 0x0 image can't have its aspect ratio computed (division by
  // zero yields Infinity/NaN), so bail out here before any ratio-based rule runs.
  if (width === 0 || height === 0) return messages;

  // Vector art is resolution-independent, so pixel-size rules do not apply.
  // An SVG reports its artboard size (Figma/Illustrator write width/height) or
  // the 300x150 viewBox-only default — neither means "too small". The 0x0 case
  // has already returned above. Aspect rules still run: proportion is intrinsic
  // to the artwork, so a 6:1 SVG lockup crowds the title just as a 6:1 PNG does.
  const isVector = SVG_EXTENSION.test(url);

  if (!isVector && spec.minWidth && width < spec.minWidth.px) {
    messages.push(
      `Only ${width}px wide — recommended ${spec.recommended}. ${spec.minWidth.consequence}`,
    );
  }

  if (!isVector && spec.minHeight && height < spec.minHeight.px) {
    messages.push(
      `Only ${height}px tall — recommended ${spec.recommended}. ${spec.minHeight.consequence}`,
    );
  }

  const ratio = width / height;

  // Portrait is a special case of an aspect miss, so it suppresses the generic
  // aspect rule. Otherwise one defect produces two messages saying the same thing.
  if (spec.rejectPortrait && height > width) {
    messages.push(
      `This image is portrait (${width} × ${height}). ${spec.rejectPortrait.consequence}`,
    );
  } else if (spec.aspect && Math.abs(ratio / spec.aspect.ratio - 1) > spec.aspect.tolerance) {
    messages.push(
      `Aspect ratio is ${formatRatio(ratio)} — the layout expects ${spec.aspect.label}. ${spec.aspect.consequence}`,
    );
  }

  if (spec.maxAspect && ratio > spec.maxAspect.ratio) {
    messages.push(
      `Aspect ratio is ${formatRatio(ratio)} — wider than the ${formatRatio(spec.maxAspect.ratio)} this layout expects. ${spec.maxAspect.consequence}`,
    );
  }

  return messages;
}
