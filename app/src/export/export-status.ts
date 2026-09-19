import { formatTimecode, type ExportRange } from "../model";

export function exportRangeLabel(range: ExportRange): string {
  if (range.kind === "loop") {
    return `${formatTimecode(range.startMs)}–${formatTimecode(range.endMs)}`;
  }
  return "FULL";
}

/** Exact Fertig line for primary Export MP4 (never used for vis-only). */
export function formatPrimaryExportFertig(opts: {
  frames: number;
  codec: string;
  byteLength: number;
  range: ExportRange;
}): string {
  return `Fertig · ${opts.frames} frames · ${opts.codec} · ${opts.byteLength} bytes · audio: aac · from A1 · range ${exportRangeLabel(opts.range)}`;
}
