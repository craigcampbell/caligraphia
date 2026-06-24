"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useNoKeyboard } from "@/hooks/useNoKeyboard";
import { usePenSounds } from "@/hooks/usePenSounds";
import {
  renderSegment,
  drawDot,
  renderStrokes,
  reseed,
  DEFAULT_INK_SEED,
  STROKE_GAP_MS,
  INK_STYLES,
  REFERENCE_WIDTH,
  type InkId,
  type StrokePoint,
} from "@/lib/ink-engine";
import {
  pageFillMetrics,
  meetsAddPageGate,
  isNearBottom,
  isNearBlankPage,
} from "@/lib/page-fill";

const DEFAULT_W = 2400;
const DEFAULT_H = 3200;

const PAPER_PRESETS = [
  { id: "blank", name: "Blank", bg: "#ffffff" },
  { id: "ruled", name: "Ruled", bg: "#fdfcf8" },
  { id: "graph", name: "Graph", bg: "#fdfdfd" },
  { id: "watercolor", name: "Watercolor", bg: "#faf6f0" },
  { id: "vellum", name: "Vellum", bg: "#f5f0e8" },
  { id: "midnight", name: "Midnight", bg: "#0d0d1a" },
] as const;

type PaperId = (typeof PAPER_PRESETS)[number]["id"];

const INK_COLORS = [
  "#1a1a2e", "#c0392b", "#2471a3", "#27ae60", "#8e44ad",
  "#d35400", "#e84393", "#2c3e50", "#6f4e37", "#16a085",
  "#d4af37", "#b8860b", "#fff1a8", "#e8e8f0",
];

export interface CanvasPage {
  strokes: StrokePoint[];
  paper: string; // a preset id, or "custom:<paperDesignId>" for user stationery
  inkStyle: InkId;
}

interface Props {
  onComplete: (pages: CanvasPage[], drawingDurationMs: number) => void;
  onCancel: () => void;
  minDrawTimeMs?: number;
  // Canvas size in drawing units — letters are 2400x3200, postcards and
  // robin sections pass their own
  canvasW?: number;
  canvasH?: number;
  submitLabel?: string;
  // Max pages this composer allows. Default 1 keeps every existing caller
  // single-page; letters pass a higher cap to enable the page bar.
  maxPages?: number;
  // When set, this image becomes the canvas backdrop instead of paper — used by
  // "write back on the same sheet" so you draw directly over the original letter.
  backgroundImageUrl?: string;
}

function drawPaper(ctx: CanvasRenderingContext2D, paper: string, w: number, h: number) {
  const preset = PAPER_PRESETS.find((p) => p.id === paper) || PAPER_PRESETS[0];
  ctx.fillStyle = preset.bg;
  ctx.fillRect(0, 0, w, h);

  if (paper === "ruled") {
    ctx.strokeStyle = "rgba(135,180,220,0.45)"; ctx.lineWidth = 1;
    for (let y = 120; y < h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = "rgba(220,80,80,0.35)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(80, 0); ctx.lineTo(80, h); ctx.stroke();
  }
  if (paper === "graph") {
    ctx.strokeStyle = "rgba(160,200,240,0.3)"; ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = "rgba(140,180,220,0.5)"; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 200) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 200) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }
  if (paper === "watercolor") {
    const imageData = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 14;
      imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + n));
      imageData.data[i + 1] = Math.min(255, Math.max(0, imageData.data[i + 1] + n));
      imageData.data[i + 2] = Math.min(255, Math.max(0, imageData.data[i + 2] + n - 2));
    }
    ctx.putImageData(imageData, 0, 0);
  }
  if (paper === "vellum") {
    const imageData = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 8;
      imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + n));
      imageData.data[i + 1] = Math.min(255, Math.max(0, imageData.data[i + 1] + n));
      imageData.data[i + 2] = Math.min(255, Math.max(0, imageData.data[i + 2] + n + 2));
    }
    ctx.putImageData(imageData, 0, 0);
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * w; const y = Math.random() * h; const r = Math.random() * 3 + 1;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(160,130,100,${Math.random() * 0.06})`; ctx.fill();
    }
  }
  if (paper === "midnight") {
    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(0, 0, w, h);
    const sd = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < sd.data.length; i += 4) {
      if (Math.random() < 0.0005) {
        sd.data[i] = 255; sd.data[i+1] = 255;
        sd.data[i+2] = 255; sd.data[i+3] = 40 + Math.random() * 80;
      }
    }
    ctx.putImageData(sd, 0, 0);
  }
}

export function CanvasDraw({
  onComplete,
  onCancel,
  minDrawTimeMs = 4000,
  canvasW = DEFAULT_W,
  canvasH = DEFAULT_H,
  submitLabel,
  maxPages = 1,
  backgroundImageUrl,
}: Props) {
  const inkScale = canvasW / REFERENCE_WIDTH;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [canSubmit, setCanSubmit] = useState(false);
  const [selectedColor, setSelectedColor] = useState(
    (() => { const h = new Date().getHours(); return (h >= 2 && h < 4) ? "#e8e8f0" : INK_COLORS[0]; })()
  );
  const [paper, setPaper] = useState<string>(
    (() => { const h = new Date().getHours(); return (h >= 2 && h < 4) ? "midnight" : "ruled"; })()
  );
  // Custom stationery: the user's + public paper designs, and the currently
  // selected one's image (used as the canvas background when paper="custom:…").
  const [customPapers, setCustomPapers] = useState<{ id: string; name: string; imageUrl: string }[]>([]);
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null);
  const [paperBusy, setPaperBusy] = useState(false);
  const [paperMsg, setPaperMsg] = useState<string | null>(null);
  const paperFileRef = useRef<HTMLInputElement>(null);
  const paperSurface = canvasW >= 2000 ? "letter" : "postcard";
  const [inkStyle, setInkStyle] = useState<InkId>("fountain");
  const [tool, setTool] = useState<"pen" | "eraser" | "hand">("pen");
  // Brush-size multiplier applied to whatever pen is selected (and the eraser).
  const [brushSize, setBrushSize] = useState(1);
  const [hint, setHint] = useState("");
  // The palette sheet holds colors, size, pen styles, paper and extras so the
  // always-visible toolbar can stay a single slim row.
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Zoom & pan. The paper fills the frame width at zoom 1 (so it starts close,
  // like writing on a real sheet); zoom multiplies that, pan slides it around.
  const viewportRef = useRef<HTMLDivElement>(null);
  const baseScaleRef = useRef(1); // CSS px per drawing unit at zoom 1 (fit-to-width)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 6;
  // Live pointer positions (client coords) for pinch/2-finger pan.
  const pointersRef = useRef<Map<number, { x: number; y: number; type: string }>>(new Map());
  const gestureRef = useRef<
    | { startDist: number; startZoom: number; startPan: { x: number; y: number }; anchor: { x: number; y: number } }
    | null
  >(null);
  const panDragRef = useRef<{ x: number; y: number } | null>(null);

  // Pen scratch sounds
  const [soundOn, setSoundOn] = useState(false);
  const { startScratch, updateScratch, stopScratch, enable, disable } = usePenSounds(paper as PaperId, inkStyle);

  // Multi-page: each page is its own stroke array. strokesRef / strokeStartsRef
  // always POINT AT the current page's arrays, so every existing drawing handler
  // keeps working unchanged — we just swap which arrays they point to.
  const pagesRef = useRef<StrokePoint[][]>([[]]);
  const pageStartsRef = useRef<number[][]>([[]]);
  const pageIndexRef = useRef(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const nudgedPagesRef = useRef<Set<number>>(new Set());
  const [nearBottom, setNearBottom] = useState(false);

  const strokesRef = useRef<StrokePoint[]>(pagesRef.current[0]);
  const firstStrokeTimeRef = useRef<number | null>(null);
  const lastPtRef = useRef<{ px: number; py: number; pressure: number; color: string; time: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stroke boundaries (indexes into strokesRef) so the last stroke can be undone
  const strokeStartsRef = useRef<number[]>(pageStartsRef.current[0]);
  const [strokeCount, setStrokeCount] = useState(0);

  // Palm rejection: once a stylus is seen, finger touches are ignored, and
  // only one pointer may draw at a time (a resting palm is a second pointer).
  const penSeenRef = useRef(false);
  const activePointerRef = useRef<number | null>(null);

  // Input smoothing state (exponential filter, speed-adaptive)
  const smoothedRef = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const vp = viewportRef.current;
      if (!vp) return;
      // Fit-to-width: the sheet fills the frame across at zoom 1, so it starts
      // close (like a real page); zoom/pan handle the rest.
      const baseScale = vp.clientWidth / canvasW;
      baseScaleRef.current = baseScale;
      canvas.width = canvasW;
      canvas.height = canvasH;
      canvas.style.width = `${canvasW * baseScale}px`;
      canvas.style.height = `${canvasH * baseScale}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) { ctxRef.current = ctx; redraw(ctx); }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); if (timerRef.current) clearInterval(timerRef.current); };
  }, [paper, inkStyle]);

  // Mirror zoom/pan into refs so the high-frequency wheel/pinch handlers read
  // current values without waiting on a React re-render.
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
    const canvas = canvasRef.current;
    if (canvas) canvas.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  }, [zoom, pan]);

  const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

  // Keep at least a sliver of the page on screen so it can't be lost.
  const clampPan = (p: { x: number; y: number }, z: number) => {
    const vp = viewportRef.current;
    if (!vp) return p;
    const vw = vp.clientWidth, vh = vp.clientHeight;
    const cw = canvasW * baseScaleRef.current * z;
    const ch = canvasH * baseScaleRef.current * z;
    const keep = 100;
    return {
      x: Math.max(keep - cw, Math.min(vw - keep, p.x)),
      y: Math.max(keep - ch, Math.min(vh - keep, p.y)),
    };
  };

  const updateView = (z: number, p: { x: number; y: number }) => {
    zoomRef.current = z;
    panRef.current = p;
    setZoom(z);
    setPan(p);
  };

  // Zoom about a point in viewport-local pixels, keeping that point anchored.
  const zoomAtPoint = (vx: number, vy: number, factor: number) => {
    const z0 = zoomRef.current, p0 = panRef.current;
    const z1 = clampZoom(z0 * factor);
    const qx = (vx - p0.x) / z0, qy = (vy - p0.y) / z0;
    updateView(z1, clampPan({ x: vx - qx * z1, y: vy - qy * z1 }, z1));
  };

  const zoomByButton = (factor: number) => {
    const vp = viewportRef.current;
    const vx = vp ? vp.clientWidth / 2 : 0;
    const vy = vp ? vp.clientHeight / 2 : 0;
    zoomAtPoint(vx, vy, factor);
  };

  const resetView = () => updateView(1, { x: 0, y: 0 });

  // Non-passive wheel: ctrl/⌘ or trackpad-pinch zooms toward the cursor; a plain
  // scroll pans. Attached natively so preventDefault actually stops page zoom.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const vx = e.clientX - rect.left, vy = e.clientY - rect.top;
      if (e.ctrlKey || e.metaKey) {
        zoomAtPoint(vx, vy, Math.exp(-e.deltaY * 0.0015));
      } else {
        const p0 = panRef.current;
        updateView(zoomRef.current, clampPan({ x: p0.x - e.deltaX, y: p0.y - e.deltaY }, zoomRef.current));
      }
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, []);

  const redraw = (ctx: CanvasRenderingContext2D) => {
    if (bgImageRef.current) {
      ctx.drawImage(bgImageRef.current, 0, 0, canvasW, canvasH);
    } else {
      drawPaper(ctx, paper, canvasW, canvasH);
    }
    reseed(DEFAULT_INK_SEED);
    renderStrokes(ctx, strokesRef.current, inkStyle, canvasW, canvasH);
  };

  // Load the canvas background — the on-sheet image (photo postcards, via prop)
  // or the selected custom stationery — then repaint. No background → paper texture.
  useEffect(() => {
    const bg = backgroundImageUrl || customBgUrl;
    if (!bg) {
      bgImageRef.current = null;
      const ctx = ctxRef.current;
      if (ctx) redraw(ctx);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      bgImageRef.current = img;
      const ctx = ctxRef.current;
      if (ctx) redraw(ctx);
    };
    img.onerror = () => {
      if (cancelled) return;
      // Couldn't load it — fall back to paper texture rather than a blank canvas.
      bgImageRef.current = null;
      const ctx = ctxRef.current;
      if (ctx) redraw(ctx);
    };
    img.src = bg;
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundImageUrl, customBgUrl]);

  // Load the writer's custom stationery (their own + public) for the palette.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/paper-designs?surface=${paperSurface}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setCustomPapers(
            (data.designs || []).map((d: { id: string; name: string; imageUrl: string }) => ({
              id: d.id,
              name: d.name,
              imageUrl: d.imageUrl,
            }))
          );
        }
      } catch {
        /* palette just won't show custom papers */
      }
    })();
    return () => { cancelled = true; };
  }, [paperSurface]);

  const choosePresetPaper = (id: string) => {
    setPaper(id);
    setCustomBgUrl(null);
  };
  const chooseCustomPaper = (d: { id: string; imageUrl: string }) => {
    setPaper(`custom:${d.id}`);
    setCustomBgUrl(d.imageUrl);
  };
  const uploadPaper = async (file: File) => {
    if (paperBusy) return;
    setPaperBusy(true);
    setPaperMsg(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("surface", paperSurface);
      const res = await fetch("/api/paper-designs", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.design) {
        setCustomPapers((prev) => [
          { id: data.design.id, name: data.design.name, imageUrl: data.design.imageUrl },
          ...prev,
        ]);
        chooseCustomPaper(data.design);
        setPaperMsg("Stationery saved & selected.");
      } else {
        setPaperMsg(data.error || "Couldn't make that into stationery.");
      }
    } catch {
      setPaperMsg("Couldn't make that into stationery.");
    } finally {
      setPaperBusy(false);
    }
  };

  // ---- Multi-page navigation ----
  // Capture the current page's live arrays back into the page store (erase/undo
  // reassign strokesRef.current, so re-point before switching or submitting).
  const flushCurrentPage = () => {
    pagesRef.current[pageIndexRef.current] = strokesRef.current;
    pageStartsRef.current[pageIndexRef.current] = strokeStartsRef.current;
  };

  const goToPage = (i: number) => {
    if (i < 0 || i >= pagesRef.current.length) return;
    flushCurrentPage();
    pageIndexRef.current = i;
    setPageIndex(i);
    strokesRef.current = pagesRef.current[i];
    strokeStartsRef.current = pageStartsRef.current[i];
    setStrokeCount(strokeStartsRef.current.length);
    setNearBottom(false);
    lastPtRef.current = null;
    smoothedRef.current = null;
    resetView(); // land at the top of the fresh page, fit-to-width
    const ctx = ctxRef.current;
    if (ctx) redraw(ctx);
  };

  const currentPageFilled = () => meetsAddPageGate(pageFillMetrics(strokesRef.current));

  const addPage = () => {
    flushCurrentPage();
    if (pagesRef.current.length >= maxPages || !currentPageFilled()) return;
    pagesRef.current.push([]);
    pageStartsRef.current.push([]);
    setPageCount(pagesRef.current.length);
    goToPage(pagesRef.current.length - 1);
  };

  const startTimer = () => {
    if (timerRef.current) return;
    setHint("Let the ink flow...");
    timerRef.current = setInterval(() => {
      if (!firstStrokeTimeRef.current) return;
      const t = Date.now() - firstStrokeTimeRef.current;
      setElapsed(t);
      if (t >= minDrawTimeMs) {
        setCanSubmit(true);
        setHint("Your letter is ready");
        if (timerRef.current) clearInterval(timerRef.current);
      } else if (t >= minDrawTimeMs * 0.66) {
        setHint("Almost there, keep writing...");
      } else if (t >= minDrawTimeMs * 0.33) {
        setHint("Good, let the ink dry a little more...");
      }
    }, 500);
  };

  const getCoords = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  }, []);

  // One-euro-style filter: heavy smoothing for slow, shaky finger writing,
  // light smoothing when moving fast so the line doesn't lag behind the pen.
  const smoothCoords = useCallback((raw: { x: number; y: number }, pointerType: string) => {
    const now = performance.now();
    const prev = smoothedRef.current;
    if (!prev) {
      smoothedRef.current = { x: raw.x, y: raw.y, t: now };
      return raw;
    }
    const dt = Math.max(1, now - prev.t);
    const speed = Math.hypot(raw.x - prev.x, raw.y - prev.y) / dt; // normalized units/ms
    const minAlpha = pointerType === "pen" ? 0.45 : 0.25;
    const alpha = Math.min(0.95, minAlpha + speed * 600);
    const x = prev.x + alpha * (raw.x - prev.x);
    const y = prev.y + alpha * (raw.y - prev.y);
    smoothedRef.current = { x, y, t: now };
    return { x, y };
  }, []);

  // Lay down one input sample. Takes raw client coords + pressure so it can be
  // fed straight from coalesced pointer events (every Apple Pencil sample, not
  // just one per frame). Width comes from pressure and true velocity.
  const drawSample = (
    clientX: number, clientY: number, rawPressure: number,
    pointerType: string, evtTime: number, tiltX?: number, tiltY?: number
  ) => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const r = canvas.getBoundingClientRect();
    const raw = {
      x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (clientY - r.top) / r.height)),
    };
    const { x, y } = smoothCoords(raw, pointerType);
    const pressure = rawPressure || 0.5;
    // High-res event time drives stroke gaps and velocity; a separate wall clock
    // drives the anti-paste "ink drying" timer.
    const t = evtTime;
    if (!firstStrokeTimeRef.current) { firstStrokeTimeRef.current = Date.now(); startTimer(); }
    strokesRef.current.push({ time: t, x, y, pressure, color: selectedColor, ink: inkStyle, size: brushSize, tiltX, tiltY });
    const px = x * canvasW;
    const py = y * canvasH;
    const prev = lastPtRef.current;
    if (prev) {
      const lastStroke = strokesRef.current[strokesRef.current.length - 2];
      if (lastStroke && t - lastStroke.time < STROKE_GAP_MS) {
        const dt = Math.max(0.5, t - prev.time);
        const velocity = Math.hypot(px - prev.px, py - prev.py) / inkScale / dt;
        renderSegment(ctx, inkStyle, prev.px, prev.py, px, py, prev.pressure, pressure, selectedColor, inkScale, brushSize, velocity);
      } else {
        drawDot(ctx, inkStyle, px, py, pressure, selectedColor, inkScale, brushSize);
      }
    } else {
      drawDot(ctx, inkStyle, px, py, pressure, selectedColor, inkScale, brushSize);
    }
    lastPtRef.current = { px, py, pressure, color: selectedColor, time: t };

    if (soundOn) {
      const speed = Math.sqrt((px - (prev?.px || px)) ** 2 + (py - (prev?.py || py)) ** 2);
      updateScratch(speed);
    }
  };

  const drawPt = (e: React.PointerEvent<HTMLCanvasElement>) =>
    drawSample(e.clientX, e.clientY, e.pressure, e.pointerType, e.nativeEvent.timeStamp, (e as any).tiltX, (e as any).tiltY);

  // Object eraser: lift out any whole stroke the eraser passes over. It edits
  // the vector stroke data (not pixels), so the server re-render matches and
  // undo keeps working.
  const eraseAt = (nx: number, ny: number) => {
    const pts = strokesRef.current;
    const starts = strokeStartsRef.current;
    if (pts.length === 0 || starts.length === 0) return;
    const cx = nx * canvasW;
    const cy = ny * canvasH;
    const radius = 60 * inkScale * Math.max(1, brushSize);
    const r2 = radius * radius;
    const removed = new Set<number>();
    for (let k = 0; k < starts.length; k++) {
      const s = starts[k];
      const e = k + 1 < starts.length ? starts[k + 1] : pts.length;
      for (let i = s; i < e; i++) {
        const ddx = pts[i].x * canvasW - cx;
        const ddy = pts[i].y * canvasH - cy;
        if (ddx * ddx + ddy * ddy <= r2) { removed.add(k); break; }
      }
    }
    if (removed.size === 0) return;
    const rebuilt: StrokePoint[] = [];
    const newStarts: number[] = [];
    for (let k = 0; k < starts.length; k++) {
      const s = starts[k];
      const e = k + 1 < starts.length ? starts[k + 1] : pts.length;
      if (removed.has(k)) continue;
      newStarts.push(rebuilt.length);
      for (let i = s; i < e; i++) rebuilt.push(pts[i]);
    }
    strokesRef.current = rebuilt;
    strokeStartsRef.current = newStarts;
    setStrokeCount(newStarts.length);
    const ctx = ctxRef.current;
    if (ctx) redraw(ctx);
  };

  // ---- Two-finger pinch-zoom / pan, and the hand (pan) tool ----
  const touchPointers = () =>
    [...pointersRef.current.values()].filter((p) => p.type === "touch");

  const beginGesture = () => {
    const t = touchPointers();
    const vp = viewportRef.current;
    if (t.length < 2 || !vp) return;
    const rect = vp.getBoundingClientRect();
    const a = { x: t[0].x - rect.left, y: t[0].y - rect.top };
    const b = { x: t[1].x - rect.left, y: t[1].y - rect.top };
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    const z0 = zoomRef.current, p0 = panRef.current;
    gestureRef.current = {
      startDist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      startZoom: z0,
      startPan: p0,
      anchor: { x: (cx - p0.x) / z0, y: (cy - p0.y) / z0 },
    };
  };

  const updateGesture = () => {
    const g = gestureRef.current;
    const t = touchPointers();
    const vp = viewportRef.current;
    if (!g || t.length < 2 || !vp) return;
    const rect = vp.getBoundingClientRect();
    const a = { x: t[0].x - rect.left, y: t[0].y - rect.top };
    const b = { x: t[1].x - rect.left, y: t[1].y - rect.top };
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const z1 = clampZoom(g.startZoom * (dist / g.startDist));
    updateView(z1, clampPan({ x: cx - g.anchor.x * z1, y: cy - g.anchor.y * z1 }, z1));
  };

  // Drop a half-drawn finger stroke when a second finger turns it into a gesture.
  const discardActiveTouchStroke = () => {
    if (activePointerRef.current === null) return;
    const ptr = pointersRef.current.get(activePointerRef.current);
    if (ptr && ptr.type === "pen") return; // never disturb a stylus stroke
    if (tool === "pen" && strokeStartsRef.current.length > 0) {
      const start = strokeStartsRef.current.pop()!;
      strokesRef.current = strokesRef.current.slice(0, start);
      setStrokeCount(strokeStartsRef.current.length);
      const ctx = ctxRef.current;
      if (ctx) redraw(ctx);
    }
    activePointerRef.current = null;
    setDrawing(false);
    lastPtRef.current = null;
    smoothedRef.current = null;
    if (soundOn) stopScratch();
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    if (e.pointerType === "pen") penSeenRef.current = true;

    // Two fingers → pinch-zoom / pan, even on a stylus device.
    if (touchPointers().length >= 2) {
      discardActiveTouchStroke();
      beginGesture();
      return;
    }
    if (gestureRef.current) return;

    // Hand tool: drag to pan.
    if (tool === "hand") {
      panDragRef.current = { x: e.clientX, y: e.clientY };
      activePointerRef.current = e.pointerId;
      canvasRef.current?.setPointerCapture(e.pointerId);
      setDrawing(true);
      return;
    }

    // Palm rejection: ignore fingers once a stylus is in play, and ignore
    // any second pointer while one is already drawing.
    if (e.pointerType === "touch" && penSeenRef.current) return;
    if (activePointerRef.current !== null) return;
    activePointerRef.current = e.pointerId;
    canvasRef.current?.setPointerCapture(e.pointerId);
    setDrawing(true);
    lastPtRef.current = null;
    smoothedRef.current = null;
    if (tool === "eraser") {
      const { x, y } = getCoords(e);
      eraseAt(x, y);
      return;
    }
    strokeStartsRef.current.push(strokesRef.current.length);
    setStrokeCount(strokeStartsRef.current.length);
    if (soundOn) startScratch();
    drawPt(e);
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    }
    if (gestureRef.current) {
      e.preventDefault();
      updateGesture();
      return;
    }
    if (tool === "hand" && panDragRef.current && e.pointerId === activePointerRef.current) {
      e.preventDefault();
      const dx = e.clientX - panDragRef.current.x;
      const dy = e.clientY - panDragRef.current.y;
      panDragRef.current = { x: e.clientX, y: e.clientY };
      updateView(zoomRef.current, clampPan({ x: panRef.current.x + dx, y: panRef.current.y + dy }, zoomRef.current));
      return;
    }
    if (!drawing || e.pointerId !== activePointerRef.current) return;
    e.preventDefault();
    if (tool === "eraser") {
      const { x, y } = getCoords(e);
      eraseAt(x, y);
      return;
    }
    // Replay every sample the device buffered between frames (Apple Pencil emits
    // far more than one per frame) for a line that tracks the pen exactly.
    const ne = e.nativeEvent as PointerEvent;
    const coalesced =
      typeof ne.getCoalescedEvents === "function" && ne.getCoalescedEvents().length
        ? ne.getCoalescedEvents()
        : [ne];
    for (const c of coalesced) {
      drawSample(c.clientX, c.clientY, c.pressure, c.pointerType, c.timeStamp, (c as any).tiltX, (c as any).tiltY);
    }
  };

  const handleUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (gestureRef.current && touchPointers().length < 2) {
      // Gesture over. If a lone finger remains, don't let it start drawing.
      gestureRef.current = null;
      activePointerRef.current = null;
      setDrawing(false);
      return;
    }
    if (gestureRef.current) return;
    if (tool === "hand") {
      panDragRef.current = null;
      if (e.pointerId === activePointerRef.current) { activePointerRef.current = null; setDrawing(false); }
      return;
    }
    if (activePointerRef.current !== null && e.pointerId !== activePointerRef.current) return;
    e.preventDefault();
    activePointerRef.current = null;
    setDrawing(false);
    lastPtRef.current = null;
    smoothedRef.current = null;
    if (soundOn) stopScratch();

    // Multi-page: once the writer reaches the bottom of a page, nudge them
    // (once per page) that they can add another.
    if (
      maxPages > 1 &&
      tool === "pen" &&
      pagesRef.current.length < maxPages &&
      !nudgedPagesRef.current.has(pageIndexRef.current) &&
      isNearBottom(pageFillMetrics(strokesRef.current))
    ) {
      nudgedPagesRef.current.add(pageIndexRef.current);
      setNearBottom(true);
      setHint("You're near the bottom — add a page when you're ready.");
    }
  };

  // Undo the most recent stroke. Pen plotters get no undo; humans on phones do.
  const handleUndo = () => {
    const starts = strokeStartsRef.current;
    if (starts.length === 0) return;
    const start = starts.pop()!;
    strokesRef.current = strokesRef.current.slice(0, start);
    setStrokeCount(starts.length);
    const ctx = ctxRef.current;
    if (ctx) redraw(ctx);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    flushCurrentPage();
    // All pages share the current paper/ink for now (one sheet of stationery).
    const pages: CanvasPage[] = pagesRef.current.map((strokes) => ({ strokes, paper, inkStyle }));
    // Drop trailing near-blank pages so a blank tail is never sent.
    while (pages.length > 1 && isNearBlankPage(pageFillMetrics(pages[pages.length - 1].strokes))) {
      pages.pop();
    }
    if (pages.length === 0 || pages[0].strokes.length < 1) return;
    const dur = firstStrokeTimeRef.current ? Date.now() - firstStrokeTimeRef.current : 0;
    onComplete(pages, dur);
  };

  // Drop a random ink splatter on the canvas
  const dropInkSplatter = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const cw = canvasW, ch = canvasH;
    const cx = cw * (0.15 + Math.random() * 0.7);
    const cy = ch * (0.15 + Math.random() * 0.7);
    const mainR = 8 + Math.random() * 30;
    const droplets = 8 + Math.floor(Math.random() * 20);

    // Main irregular blot
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += 0.08) {
      const wobble = 1 + (Math.random() - 0.5) * 0.5;
      const px = cx + Math.cos(a) * mainR * wobble;
      const py = cy + Math.sin(a) * mainR * wobble;
      a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = selectedColor;
    ctx.globalAlpha = 0.5 + Math.random() * 0.4;
    ctx.fill();

    // Droplets
    for (let i = 0; i < droplets; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = mainR * (0.6 + Math.random() * 3.5);
      const dx = Math.cos(angle) * dist;
      const dyRaw = Math.sin(angle) * dist;
      const dy = dyRaw + (dyRaw > 0 ? dyRaw * 0.15 : 0);
      const dr = 1 + Math.random() * 8;
      ctx.beginPath();
      ctx.ellipse(cx + dx, cy + dy, dr, dr * (0.5 + Math.random() * 0.6), angle * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = selectedColor;
      ctx.globalAlpha = 0.2 + Math.random() * 0.5;
      ctx.fill();
      // Satellites
      if (Math.random() > 0.5) for (let s = 0; s < 2; s++) {
        ctx.beginPath();
        ctx.arc(cx + dx + (Math.random() - 0.5) * 12, cy + dy + (Math.random() - 0.5) * 12, Math.random() * 3 + 0.5, 0, Math.PI * 2);
        ctx.fillStyle = selectedColor; ctx.globalAlpha = Math.random() * 0.3; ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }, [selectedColor]);

  return (
    <div className="canvas-shell notranslate" translate="no">
      <div className="canvas-toolbar">
        <div className="tool-seg">
          <button className={`seg-btn ${tool === "pen" ? "active" : ""}`} onClick={() => setTool("pen")} title="Pen" aria-label="Pen">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21l3.5-1L20 6.5 17.5 4 4 17.5z"/><path d="M14.5 6.5l3 3"/></svg>
          </button>
          <button className={`seg-btn ${tool === "eraser" ? "active" : ""}`} onClick={() => setTool("eraser")} title="Eraser — drag over a stroke to lift it off" aria-label="Eraser">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 16l6 6h9M16 3l5 5L10 19l-6-6z"/></svg>
          </button>
          <button className={`seg-btn ${tool === "hand" ? "active" : ""}`} onClick={() => setTool("hand")} title="Pan — drag to move the page" aria-label="Pan">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 13V6a1.5 1.5 0 0 1 3 0v5m0-1a1.5 1.5 0 0 1 3 0v1m0 0a1.5 1.5 0 0 1 3 0v4a5 5 0 0 1-5 5h-1a6 6 0 0 1-5-3l-2.5-4s-.4-1 .6-1.6 1.9.6 1.9.6L8 14"/></svg>
          </button>
        </div>

        <button className="swatch-btn" onClick={() => setPaletteOpen(true)} title="Colour, pens & paper" aria-label="Open palette" style={{ background: selectedColor }} />

        <button className="pen-name-btn" onClick={() => setPaletteOpen(true)} title="Choose pen">
          {INK_STYLES.find((s) => s.id === inkStyle)?.name || "Pen"}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
        </button>

        <div className="toolbar-spacer" />

        <div className="ink-level-wrap" title={canSubmit ? "Ready to send" : (hint || "Ink still flowing...")}>
          <svg width="16" height="22" viewBox="0 0 18 24" className="ink-icon" aria-hidden="true">
            <rect x="3" y="2" width="12" height="20" rx="2" fill="none" stroke="#8c7a60" strokeWidth="1.2" opacity="0.5"/>
            <rect x="6" y="0" width="6" height="3" rx="1" fill="none" stroke="#8c7a60" strokeWidth="1" opacity="0.4"/>
            <rect x="4" y={4 + (1 - Math.min(elapsed / minDrawTimeMs, 1)) * 16} width="10" height={Math.min(elapsed / minDrawTimeMs, 1) * 16}
              rx="1" fill={canSubmit ? "#27ae60" : selectedColor} opacity={canSubmit ? 0.8 : 0.6}/>
          </svg>
        </div>

        <button className="more-btn" onClick={() => setPaletteOpen(true)} title="Palette — colours, size, pens, paper" aria-label="Open palette">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
        </button>
      </div>

      {paletteOpen && (
        <div className="palette-backdrop" onClick={() => setPaletteOpen(false)}>
          <div className="palette-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Drawing palette">
            <div className="palette-head">
              <span className="palette-title">Palette</span>
              <button className="palette-close" onClick={() => setPaletteOpen(false)} aria-label="Close palette">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="palette-section">
              <span className="palette-label">Colour</span>
              <div className="ink-palette">
                {INK_COLORS.map((c) => (
                  <button key={c} className={`ink-swatch ${selectedColor === c ? "active" : ""}`} onClick={() => setSelectedColor(c)} style={{ background: c }} aria-label={c} />
                ))}
                <label className="custom-color" title="Choose custom ink color">
                  <input type="color" value={selectedColor} onChange={(e) => setSelectedColor(e.currentTarget.value.toLowerCase())} aria-label="Choose custom ink color" />
                </label>
              </div>
            </div>

            <div className="palette-section">
              <span className="palette-label">Size</span>
              <label className="size-control" title="Brush / eraser size">
                <input type="range" min={0.4} max={3} step={0.1} value={brushSize} onChange={(e) => setBrushSize(parseFloat(e.currentTarget.value))} className="size-range" aria-label="Brush size" />
                <span className="size-dot" style={{ width: 6 + brushSize * 9, height: 6 + brushSize * 9 }} />
              </label>
            </div>

            <div className="palette-section">
              <span className="palette-label">Pen</span>
              <div className="ink-style-chooser">
                {INK_STYLES.map((s) => (
                  <button key={s.id} className={`ink-chip ${inkStyle === s.id ? "active" : ""}`} onClick={() => setInkStyle(s.id)} title={s.desc}>{s.name}</button>
                ))}
              </div>
            </div>

            <div className="palette-section">
              <span className="palette-label">Paper</span>
              <div className="paper-chooser">
                {PAPER_PRESETS.map((p) => (
                  <button key={p.id} className={`paper-chip ${paper === p.id ? "active" : ""}`} onClick={() => choosePresetPaper(p.id)} style={{ background: p.bg }}>{p.name}</button>
                ))}
                {customPapers.map((d) => (
                  <button
                    key={d.id}
                    className={`paper-chip paper-chip-custom ${paper === `custom:${d.id}` ? "active" : ""}`}
                    onClick={() => chooseCustomPaper(d)}
                    style={{ backgroundImage: `url(${d.imageUrl})` }}
                    title={d.name}
                    aria-label={d.name}
                  />
                ))}
                <button
                  className="paper-chip paper-make"
                  onClick={() => paperFileRef.current?.click()}
                  disabled={paperBusy}
                  title="Turn a photo into your own stationery (costs 20 stamps)"
                >
                  {paperBusy ? "…" : "＋ Make your own"}
                </button>
                <input
                  ref={paperFileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPaper(f); e.currentTarget.value = ""; }}
                />
              </div>
              <div className="paper-make-note">Make your own from a photo — 20 stamps.</div>
              {paperMsg && <div className="paper-msg">{paperMsg}</div>}
            </div>

            <div className="palette-section">
              <span className="palette-label">Extras</span>
              <div className="extras-row">
                <button
                  className={`sound-toggle ${soundOn ? "on" : ""}`}
                  onClick={() => {
                    if (soundOn) { setSoundOn(false); disable(); }
                    else { setSoundOn(true); enable(); startScratch(); setTimeout(() => stopScratch(), 50); }
                  }}
                  title={soundOn ? "Pen sounds on" : "Pen sounds off"}
                  aria-label="Toggle pen sounds"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {soundOn ? (
                      <>
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                      </>
                    ) : (
                      <>
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <line x1="22" y1="9" x2="17" y2="15" />
                        <line x1="17" y1="9" x2="22" y2="15" />
                      </>
                    )}
                  </svg>
                </button>
                <span className="extras-label">Pen sounds</span>
                <button className="ink-splatter-btn" onClick={dropInkSplatter} title="Drop an ink splatter" aria-label="Drop an ink splatter">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2.5c-3 4-7 7.5-7 11.5a7 7 0 0 0 14 0c0-4-4-7.5-7-11.5z"/>
                    <circle cx="12" cy="14" r="1.5" fill="currentColor"/>
                  </svg>
                </button>
                <span className="extras-label">Ink splatter</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="canvas-viewport" ref={viewportRef}>
        <canvas ref={canvasRef} className="draw-canvas notranslate" translate="no"
          onPointerDown={handleDown} onPointerMove={handleMove}
          onPointerUp={handleUp} onPointerLeave={handleUp} onPointerCancel={handleUp}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            touchAction: "none",
            transformOrigin: "0 0",
            cursor: tool === "hand" ? "grab" : tool === "eraser" ? "cell" : "crosshair",
          }}
        />
        <div className="zoom-controls notranslate" translate="no">
          <button className="zoom-btn" onClick={() => zoomByButton(1 / 1.25)} title="Zoom out" aria-label="Zoom out">&#8722;</button>
          <button className="zoom-pct" onClick={resetView} title="Reset view">{Math.round(zoom * 100)}%</button>
          <button className="zoom-btn" onClick={() => zoomByButton(1.25)} title="Zoom in" aria-label="Zoom in">&#43;</button>
        </div>
      </div>

      {maxPages > 1 && (
        <div className="page-bar notranslate" translate="no">
          <button
            className="page-nav-btn"
            onClick={() => goToPage(pageIndex - 1)}
            disabled={pageIndex === 0}
            aria-label="Previous page"
          >&#8249;</button>
          <span className="page-indicator">Page {pageIndex + 1} / {pageCount}</span>
          <button
            className="page-nav-btn"
            onClick={() => goToPage(pageIndex + 1)}
            disabled={pageIndex >= pageCount - 1}
            aria-label="Next page"
          >&#8250;</button>
          <button
            className={`page-add-btn ${nearBottom ? "pulse" : ""}`}
            onClick={addPage}
            disabled={pageCount >= maxPages || !meetsAddPageGate(pageFillMetrics(strokesRef.current))}
            title={
              pageCount >= maxPages
                ? `A letter can have at most ${maxPages} pages`
                : "Fill more of this page before you can add another"
            }
          >+ Add page</button>
        </div>
      )}

      <div className="canvas-actions">
        <button onClick={onCancel} className="btn-cancel">Discard</button>
        <button onClick={handleUndo} className="btn-undo" disabled={strokeCount === 0} title="Undo last stroke">
          &#8630; Undo stroke
        </button>
        <button onClick={handleSubmit} className={`btn-submit ${canSubmit ? "ready" : "disabled"}`} disabled={!canSubmit}>
          {canSubmit ? (submitLabel || "Send Your Letter") : "Ink still drying..."}
        </button>
      </div>

      <style>{`
        .canvas-shell {
          display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%;
          user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
        }
        .canvas-topbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; width: 100%; }

        /* Slim always-visible toolbar */
        .canvas-toolbar { display: flex; align-items: center; gap: 8px; width: 100%; padding: 4px 0; }
        .tool-seg { display: flex; border: 1px solid #d0c8b8; border-radius: 10px; overflow: hidden; background: #fefdf9; flex-shrink: 0; }
        .seg-btn {
          display: flex; align-items: center; justify-content: center;
          width: 40px; height: 36px; border: none; background: none; cursor: pointer;
          color: #8c7a60; padding: 0; border-left: 1px solid #ece4d4;
        }
        .seg-btn:first-child { border-left: none; }
        .seg-btn:hover { color: #5c4a30; background: rgba(0,0,0,0.03); }
        .seg-btn.active { background: #ede0cc; color: #5c4a30; }
        .swatch-btn {
          width: 32px; height: 32px; border-radius: 50%; border: 2px solid #fff;
          box-shadow: 0 0 0 1.5px #c8bfa8; cursor: pointer; padding: 0; flex-shrink: 0;
        }
        .swatch-btn:hover { box-shadow: 0 0 0 1.5px #8b4513; }
        .pen-name-btn {
          display: flex; align-items: center; gap: 5px; height: 36px; padding: 0 12px;
          border: 1px solid #d0c8b8; border-radius: 10px; background: #fefdf9; cursor: pointer;
          font-size: 13px; font-weight: 600; color: #5c4a30; font-family: inherit; white-space: nowrap;
        }
        .pen-name-btn:hover { border-color: #8b4513; }
        .toolbar-spacer { flex: 1; }
        .more-btn {
          display: flex; align-items: center; justify-content: center;
          width: 38px; height: 36px; border: 1px solid #d0c8b8; border-radius: 10px;
          background: #fefdf9; cursor: pointer; color: #5c4a30; padding: 0; flex-shrink: 0;
        }
        .more-btn:hover { border-color: #8b4513; }

        /* Palette sheet (bottom sheet) */
        .palette-backdrop {
          position: fixed; inset: 0; background: rgba(40,30,20,0.28); z-index: 400;
          display: flex; align-items: flex-end; justify-content: center;
        }
        .palette-sheet {
          width: 100%; max-width: 720px; max-height: 82vh; overflow-y: auto;
          background: #fdfbf5; border: 1px solid #e0d5c0; border-bottom: none;
          border-radius: 16px 16px 0 0; padding: 0 18px 28px;
          box-shadow: 0 -10px 40px rgba(60,40,20,0.18);
        }
        .palette-head {
          display: flex; align-items: center; justify-content: space-between;
          position: sticky; top: 0; background: #fdfbf5; padding: 12px 0 8px; z-index: 1;
        }
        .palette-title { font-size: 15px; font-weight: 700; color: #2c2416; }
        .palette-close {
          display: flex; align-items: center; justify-content: center;
          width: 34px; height: 34px; border: none; background: none; cursor: pointer;
          color: #8c7a60; border-radius: 8px;
        }
        .palette-close:hover { background: rgba(0,0,0,0.05); color: #2c2416; }
        .palette-section { padding: 11px 0; border-top: 1px solid #f0e8d8; }
        .palette-section:first-of-type { border-top: none; }
        .palette-label { display: block; font-size: 12px; font-weight: 600; color: #8c7a60; margin-bottom: 10px; }
        .palette-section .ink-swatch { width: 30px; height: 30px; }
        .palette-section .custom-color { width: 32px; height: 32px; }
        .palette-section .size-control { width: 100%; }
        .palette-section .size-range { flex: 1; width: auto; }
        .extras-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .extras-label { font-size: 13px; color: #6b5c40; margin-right: 10px; }
        .tool-group { display: flex; align-items: center; gap: 12px; }
        .pen-eraser { display: flex; gap: 4px; }
        .tool-btn {
          padding: 5px 14px; border: 1.5px solid #d0c8b8; border-radius: 8px;
          cursor: pointer; font-size: 12px; font-family: inherit; font-weight: 600;
          color: #5c5040; background: #fefdf9; transition: all 0.15s;
        }
        .tool-btn:hover { border-color: #b0a090; }
        .tool-btn.active { border-color: #8b4513; background: #ede0cc; box-shadow: 0 0 0 2px rgba(139,69,19,0.15); }
        .size-control { display: flex; align-items: center; gap: 8px; }
        .size-caption { font-size: 12px; color: #8c7a60; font-weight: 500; }
        .size-range { width: 90px; accent-color: #8b4513; cursor: pointer; }
        .size-dot { display: inline-block; border-radius: 50%; background: #5c5040; flex-shrink: 0; transition: width 0.1s, height 0.1s; }
        .paper-chooser, .ink-style-chooser { display: flex; gap: 4px; flex-wrap: wrap; }
        .paper-chip, .ink-chip {
          padding: 5px 12px; border: 1.5px solid #d0c8b8; border-radius: 8px;
          cursor: pointer; font-size: 12px; font-family: inherit; font-weight: 500;
          color: #5c5040; transition: all 0.15s; background: #fefdf9;
        }
        .ink-chip { background: #f5f0e8; }
        .paper-chip.active, .ink-chip.active {
          border-color: #8b4513;
          box-shadow: 0 0 0 2px rgba(139,69,19,0.15);
        }
        .ink-chip.active { background: #ede0cc; font-weight: 700; }
        .paper-chip:hover, .ink-chip:hover { border-color: #b0a090; }
        .paper-chip-custom {
          width: 40px; height: 30px; padding: 0; background-size: cover; background-position: center;
          text-indent: -9999px; overflow: hidden;
        }
        .paper-make { font-weight: 600; color: #8b4513; border-style: dashed; }
        .paper-make:disabled { opacity: 0.6; cursor: default; }
        .paper-make-note { font-size: 11px; color: #a89a82; margin-top: 6px; }
        .paper-msg { font-size: 12px; color: #5c4a30; margin-top: 4px; }
        .ink-palette { display: flex; gap: 4px; flex-wrap: wrap; }
        .ink-swatch { width: 24px; height: 24px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; transition: transform 0.12s; }
        .ink-swatch.active { border-color: #333; transform: scale(1.25); box-shadow: 0 0 6px rgba(0,0,0,0.2); }
        .ink-swatch:hover { transform: scale(1.15); }
        .custom-color {
          width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid #d0c8b8;
          background: conic-gradient(#c0392b, #d4af37, #27ae60, #2471a3, #8e44ad, #c0392b);
          display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
          overflow: hidden;
        }
        .custom-color input {
          width: 34px; height: 34px; opacity: 0; cursor: pointer; border: 0; padding: 0;
        }
        .canvas-status { display: flex; gap: 10px; align-items: center; font-size: 13px; margin-left: auto; }
        .ink-level-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ink-bottle {
          display: flex;
          align-items: center;
        }
        .ink-icon { display: block; }
        .ink-hint {
          font-size: 12px;
          color: #b0a090;
          font-style: italic;
          transition: color 0.3s;
        }
        .ink-hint.ready {
          color: #27ae60;
          font-weight: 600;
          font-style: normal;
        }
        .sound-toggle {
          display: flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border: 1.5px solid #d0c8b8;
          border-radius: 50%; background: #fefdf9; cursor: pointer;
          color: #b0a090; transition: all 0.15s; padding: 0;
        }
        .sound-toggle:hover { border-color: #8b4513; color: #8b4513; }
        .sound-toggle.on {
          background: #f0e8d8; border-color: #8b4513; color: #8b4513;
        }
        .ink-splatter-btn {
          display: flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border: 1.5px solid #d0c8b8;
          border-radius: 50%; background: #fefdf9; cursor: pointer;
          color: #b0a090; transition: all 0.15s; padding: 0;
        }
        .ink-splatter-btn:hover { border-color: #8b4513; color: #8b4513; background: #fff5f0; }
        .canvas-viewport {
          position: relative; width: 100%;
          height: 70vh; max-height: 820px; min-height: 360px;
          overflow: hidden; border: 1px solid #d8d0c0; border-radius: 6px;
          background: #e7e1d4; touch-action: none;
          box-shadow: inset 0 2px 14px rgba(80,40,20,0.08);
        }
        .draw-canvas {
          position: absolute; top: 0; left: 0;
          box-shadow: 0 2px 20px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.05);
          will-change: transform;
        }
        .zoom-controls {
          position: absolute; bottom: 12px; right: 12px; display: flex; align-items: center;
          gap: 2px; background: rgba(255,254,249,0.94); border: 1px solid #d8d0c0;
          border-radius: 10px; padding: 3px; box-shadow: 0 2px 10px rgba(0,0,0,0.12);
          backdrop-filter: blur(2px);
        }
        .zoom-btn {
          width: 32px; height: 32px; border: none; background: none; cursor: pointer;
          font-size: 19px; line-height: 1; color: #5c4a30; border-radius: 7px; font-family: inherit;
        }
        .zoom-btn:hover { background: rgba(0,0,0,0.06); }
        .zoom-pct {
          min-width: 52px; height: 32px; border: none; background: none; cursor: pointer;
          font-size: 12px; font-weight: 600; color: #5c4a30; border-radius: 7px; font-family: inherit;
        }
        .zoom-pct:hover { background: rgba(0,0,0,0.06); }
        .page-bar {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          width: 100%; padding: 2px 0;
        }
        .page-nav-btn {
          width: 34px; height: 34px; border: 1px solid #d0c8b8; border-radius: 8px;
          background: #fefdf9; cursor: pointer; font-size: 18px; line-height: 1; color: #5c4a30;
          font-family: inherit;
        }
        .page-nav-btn:hover:not(:disabled) { border-color: #8b4513; }
        .page-nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .page-indicator { font-size: 13px; font-weight: 600; color: #5c4a30; min-width: 92px; text-align: center; }
        .page-add-btn {
          padding: 7px 16px; border: 1px solid #d0c8b8; border-radius: 8px;
          background: #fefdf9; cursor: pointer; font-size: 13px; font-weight: 600;
          color: #5c4a30; font-family: inherit; margin-left: 6px;
        }
        .page-add-btn:hover:not(:disabled) { border-color: #8b4513; color: #8b4513; }
        .page-add-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .page-add-btn.pulse:not(:disabled) {
          border-color: #8b4513; color: #8b4513; background: #fef6ee;
          animation: page-pulse 1.4s ease-in-out infinite;
        }
        @keyframes page-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(139,69,19,0.0); } 50% { box-shadow: 0 0 0 4px rgba(139,69,19,0.12); } }
        .canvas-actions { display: flex; gap: 14px; padding: 6px 0 20px; }
        .btn-cancel { padding: 12px 32px; border: 1px solid #ccc; border-radius: 8px; background: #fff; cursor: pointer; font-size: 15px; font-weight: 500; font-family: inherit; }
        .btn-cancel:hover { background: #f8f5f0; }
        .btn-undo { padding: 12px 24px; border: 1px solid #d0c8b8; border-radius: 8px; background: #fefdf9; color: #5c4a30; cursor: pointer; font-size: 15px; font-weight: 500; font-family: inherit; }
        .btn-undo:hover:not(:disabled) { border-color: #8b4513; color: #8b4513; }
        .btn-undo:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-submit { padding: 12px 32px; border: none; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 700; font-family: inherit; transition: all 0.2s; }
        .btn-submit.disabled { background: #e0ddd5; color: #999; cursor: not-allowed; }
        .btn-submit.ready { background: #1a1a1a; color: #fff; box-shadow: 0 4px 16px rgba(0,0,0,0.18); }
        .btn-submit.ready:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(0,0,0,0.18); }

        /* Phones: tighten the toolbar so the paper gets the room, and make the
           action buttons easy thumb targets. */
        @media (max-width: 640px) {
          .canvas-topbar { gap: 6px; }
          .paper-chip, .ink-chip, .tool-btn { padding: 5px 9px; font-size: 11px; }
          .ink-swatch { width: 22px; height: 22px; }
          .canvas-status { margin-left: 0; width: 100%; justify-content: space-between; }
          .ink-hint { display: none; }
          .size-control { gap: 6px; }
          .size-range { width: 72px; }
          .canvas-viewport { height: 64vh; }
          .canvas-actions { gap: 8px; width: 100%; padding-bottom: 24px; }
          .btn-cancel, .btn-undo, .btn-submit { padding: 12px 10px; font-size: 14px; flex: 1; }
        }
      `}</style>
    </div>
  );
}
