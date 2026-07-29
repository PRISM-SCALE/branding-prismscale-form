import { useEffect, useState } from "react";
import { evaluateSpec, type ImageSpec } from "./imageSpec";

export type SpecStatus = "idle" | "checking" | "ok" | "warn";
export type SpecResult = { status: SpecStatus; messages: string[] };

const IDLE: SpecResult = { status: "idle", messages: [] };

/**
 * Measures an already-uploaded image from its URL and evaluates it against a spec.
 *
 * Measuring the URL rather than the File is deliberate: the S3 upload completes
 * before the URL reaches this component, so a fresh upload and a draft restored
 * from localStorage are the same case and share one code path.
 *
 * `naturalWidth` / `naturalHeight` are readable cross-origin without CORS headers
 * — only canvas pixel reads are restricted — so this needs no S3 bucket changes.
 */
export function useImageSpec(
  url: string | undefined,
  spec: ImageSpec | undefined,
): SpecResult {
  const [result, setResult] = useState<SpecResult>(IDLE);

  useEffect(() => {
    if (!url || !spec) {
      setResult(IDLE);
      return;
    }

    let cancelled = false;
    setResult({ status: "checking", messages: [] });

    const img = new Image();

    img.onload = () => {
      if (cancelled) return;
      const messages = evaluateSpec(
        { width: img.naturalWidth, height: img.naturalHeight },
        url,
        spec,
      );
      setResult({
        status: messages.length > 0 ? "warn" : "ok",
        messages,
      });
    };

    // A failure to measure is not evidence of a bad asset, so stay silent.
    img.onerror = () => {
      if (cancelled) return;
      setResult(IDLE);
    };

    img.src = url;

    // Guards against a fast re-upload landing a stale measurement over a newer one.
    return () => {
      cancelled = true;
    };
    // `spec` is a module-level constant at every call site, so it is referentially
    // stable and safe as a dependency.
  }, [url, spec]);

  return result;
}
