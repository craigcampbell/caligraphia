// Shared, isomorphic page-fill metrics for multi-page letters. Imported by BOTH
// the client canvas (to gate the "Add page" button + nudge near the bottom) and
// the server (to re-validate every page and strip blank tails). Keeping the
// thresholds here means the two sides can never drift apart.

import { STROKE_GAP_MS, type StrokePoint } from "./ink-engine";

// Hard cap on pages per letter — five 2400x3200 sheets is already a long letter.
export const MAX_PAGES = 5;

// The lowest band of the page; reaching it means "running out of room".
export const BOTTOM_BAND_Y = 0.85;

export interface PageFillMetrics {
  pointCount: number;
  strokeCount: number;
  vSpan: number; // how far down the page the writing reaches (0..1)
  hSpan: number;
  bboxCoverage: number; // vSpan * hSpan
  drawnMs: number; // span of timestamps on this page
  maxY: number;
  bottomBandPoints: number;
}

export function pageFillMetrics(strokes: StrokePoint[] | undefined | null): PageFillMetrics {
  const empty: PageFillMetrics = {
    pointCount: 0, strokeCount: 0, vSpan: 0, hSpan: 0,
    bboxCoverage: 0, drawnMs: 0, maxY: 0, bottomBandPoints: 0,
  };
  if (!strokes || strokes.length === 0) return empty;

  // Stroke count comes from time gaps, so sort by time defensively (stored
  // arrays aren't guaranteed ordered).
  const sorted = [...strokes].sort((a, b) => a.time - b.time);
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  let minT = Infinity, maxT = -Infinity;
  let strokeCount = 0, bottomBandPoints = 0;
  let prevT: number | null = null;

  for (const p of sorted) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    if (p.time < minT) minT = p.time;
    if (p.time > maxT) maxT = p.time;
    if (p.y >= BOTTOM_BAND_Y) bottomBandPoints++;
    if (prevT === null || p.time - prevT > STROKE_GAP_MS) strokeCount++;
    prevT = p.time;
  }

  const vSpan = Math.max(0, maxY - minY);
  const hSpan = Math.max(0, maxX - minX);
  return {
    pointCount: sorted.length,
    strokeCount,
    vSpan,
    hSpan,
    bboxCoverage: vSpan * hSpan,
    drawnMs: maxT - minT,
    maxY,
    bottomBandPoints,
  };
}

// To UNLOCK "add another page", the current page must be genuinely filled —
// real handwriting that descends most of the sheet, not a doodle in a corner.
export function meetsAddPageGate(m: PageFillMetrics): boolean {
  return (
    m.strokeCount >= 12 &&
    m.pointCount >= 300 &&
    m.vSpan >= 0.55 &&
    m.drawnMs >= 6000 &&
    m.bboxCoverage >= 0.12
  );
}

// Server bar for any page beyond the first: enough writing to justify its
// existence, but a legitimately short final page is allowed (no vSpan/bbox).
export function meetsExtraPageContent(m: PageFillMetrics): boolean {
  return m.strokeCount >= 12 && m.pointCount >= 300 && m.drawnMs >= 6000;
}

// A page worth dropping if it's trailing — essentially blank.
export function isNearBlankPage(m: PageFillMetrics): boolean {
  return m.strokeCount < 3 || m.pointCount < 30 || m.drawnMs < 1500;
}

// "You're near the bottom — add a page?" The AND keeps a lone descender/flourish
// from tripping it; they must actually be writing down in the band.
export function isNearBottom(m: PageFillMetrics): boolean {
  return m.maxY >= BOTTOM_BAND_Y && m.bottomBandPoints >= 40;
}

// Drop trailing near-blank pages (only the tail; a sparse middle page is kept).
// Always keeps at least the first page.
export function stripTrailingBlankPages<T extends { strokes: StrokePoint[] }>(pages: T[]): T[] {
  const out = [...pages];
  while (out.length > 1 && isNearBlankPage(pageFillMetrics(out[out.length - 1].strokes))) {
    out.pop();
  }
  return out;
}
