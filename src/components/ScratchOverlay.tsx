"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  postImageUrl: string;
  onScratchSubmit: (svgData: string) => void;
  onClose: () => void;
}

export function ScratchOverlay({ postImageUrl, onScratchSubmit, onClose }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [drawing, setDrawing] = useState(false);
  const currentPathRef = useRef<string>("");

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.setPointerCapture(e.pointerId);
    setDrawing(true);

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const cursor = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    currentPathRef.current = `M${cursor.x},${cursor.y}`;
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing) return;
    const svg = svgRef.current;
    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const cursor = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    currentPathRef.current += ` L${cursor.x},${cursor.y}`;
  };

  const handlePointerUp = () => {
    if (!drawing) return;
    setDrawing(false);
    if (currentPathRef.current) {
      setPaths((prev) => [...prev, currentPathRef.current]);
    }
    currentPathRef.current = "";
  };

  const handleSubmit = () => {
    if (paths.length === 0) return;
    const svgData = paths
      .map(
        (d) =>
          `<path d="${d}" stroke="#e53e3e" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>`
      )
      .join("");
    onScratchSubmit(svgData);
  };

  return (
    <div className="scratch-overlay">
      <div className="scratch-header">
        <span className="scratch-title">Scratch on this post</span>
        <div className="scratch-actions">
          <button onClick={() => setPaths([])} className="btn-clear">
            Clear
          </button>
          <button onClick={handleSubmit} className="btn-scratch">
            Save Scratch
          </button>
          <button onClick={onClose} className="btn-close">
            Done
          </button>
        </div>
      </div>

      <div className="scratch-canvas-wrapper">
        <img
          src={postImageUrl}
          alt=""
          className="scratch-base-image"
        />
        <svg
          ref={svgRef}
          className="scratch-svg"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ touchAction: "none" }}
        >
          {paths.map((d, i) => (
            <path
              key={i}
              d={d}
              stroke="#e53e3e"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.7"
            />
          ))}
        </svg>
      </div>

      <style>{`
        .scratch-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.85);
          z-index: 200;
          display: flex;
          flex-direction: column;
        }
        .scratch-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #1a1a1a;
          color: #fff;
        }
        .scratch-title {
          font-weight: 600;
          font-size: 16px;
        }
        .scratch-actions {
          display: flex;
          gap: 8px;
        }
        .btn-clear, .btn-close {
          padding: 8px 16px;
          border: 1px solid #555;
          border-radius: 6px;
          background: transparent;
          color: #fff;
          cursor: pointer;
          font-family: inherit;
          font-size: 14px;
        }
        .btn-scratch {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          background: #e53e3e;
          color: #fff;
          cursor: pointer;
          font-weight: 600;
          font-family: inherit;
          font-size: 14px;
        }
        .btn-clear:hover, .btn-close:hover {
          background: #333;
        }
        .btn-scratch:hover {
          background: #c53030;
        }
        .scratch-canvas-wrapper {
          flex: 1;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .scratch-base-image {
          max-width: 90%;
          max-height: 90%;
          object-fit: contain;
        }
        .scratch-svg {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          cursor: crosshair;
        }
      `}</style>
    </div>
  );
}
