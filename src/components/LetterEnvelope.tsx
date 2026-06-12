"use client";

import { useState, useRef, useMemo } from "react";
import { generateWaxSealSvg, generateMidnightOverlay } from "@/lib/seal";

interface EnvelopeData {
  stampX: number;
  stampY: number;
  waxSealSvg: string | null;
  waxSealColor: string;
  foldStyle: "tri-fold" | "quarter-fold";
}

interface Props {
  letterImageUrl: string;
  onComplete: (envelopeData: EnvelopeData, signatureStrokes?: any[]) => void;
  onBack: () => void;
  username?: string;
  stampCount?: number;
  isMidnight?: boolean;
}

const WAX_COLORS = [
  "#b22222", // Classic red
  "#8b0000", // Dark crimson
  "#daa520", // Gold
  "#2f4f4f", // Dark slate
  "#4a0e4e", // Purple
  "#8b4513", // Brown
];

export function LetterEnvelope({ letterImageUrl, onComplete, onBack, username, stampCount, isMidnight }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [envelopeData, setEnvelopeData] = useState<EnvelopeData>({
    stampX: 0.75,
    stampY: 0.1,
    waxSealSvg: null,
    waxSealColor: "#b22222",
    foldStyle: "tri-fold",
  });
  const [sealPos, setSealPos] = useState<{ x: number; y: number } | null>(null);
  const [signing, setSigning] = useState(false);
  const [signatureStrokes, setSignatureStrokes] = useState<any[]>([]);
  const [drawingSig, setDrawingSig] = useState(false);
  const [currentSigPath, setCurrentSigPath] = useState("");

  // Midnight overlay
  const midnightOverlay = useMemo(() => {
    if (isMidnight) {
      return generateMidnightOverlay();
    }
    return null;
  }, [isMidnight]);

  const toSvgPoint = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM()!.inverse());
  };

  const placeSeal = (x: number, y: number, color: string) => {
    const markup = username
      ? generateWaxSealSvg(username, stampCount || 0, color)
      : `<circle cx="30" cy="30" r="26" fill="${color}" opacity="0.92"/>
         <circle cx="30" cy="30" r="20" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>`;
    setEnvelopeData((prev) => ({
      ...prev,
      waxSealColor: color,
      waxSealSvg: `<g transform="translate(${(x - 30).toFixed(1)},${(y - 30).toFixed(1)})">${markup}</g>`,
    }));
    setSealPos({ x, y });
  };

  const handleSealTap = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const cursor = toSvgPoint(e);
    if (sealPos && Math.hypot(cursor.x - sealPos.x, cursor.y - sealPos.y) < 40) {
      // Tap the existing seal to lift it off
      setEnvelopeData((prev) => ({ ...prev, waxSealSvg: null }));
      setSealPos(null);
    } else {
      placeSeal(cursor.x, cursor.y, envelopeData.waxSealColor);
    }
  };

  const pickWaxColor = (color: string) => {
    if (sealPos) {
      // Re-press the seal in the new wax
      placeSeal(sealPos.x, sealPos.y, color);
    } else {
      setEnvelopeData((prev) => ({ ...prev, waxSealColor: color }));
    }
  };

  const startSig = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || !signing) return;
    svgRef.current.setPointerCapture(e.pointerId);
    setDrawingSig(true);
    const cursor = toSvgPoint(e);
    setCurrentSigPath(`M${cursor.x},${cursor.y}`);
  };

  const moveSig = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawingSig || !signing || !svgRef.current) return;
    const cursor = toSvgPoint(e);
    setCurrentSigPath((prev) => prev + ` L${cursor.x},${cursor.y}`);
  };

  const endSig = () => {
    if (!drawingSig) return;
    setDrawingSig(false);
    if (currentSigPath) {
      setSignatureStrokes((prev) => [...prev, currentSigPath]);
    }
    setCurrentSigPath("");
  };

  const handleSend = () => {
    onComplete(envelopeData, signatureStrokes.length > 0 ? signatureStrokes : undefined);
  };

  const paperFill = isMidnight ? "#23233c" : "#fffef9";
  const bodyFill = isMidnight ? "#1a1a2e" : "#f3ecdc";
  const seamFill = isMidnight ? "#16162a" : "#eee5d2";
  const edgeStroke = isMidnight ? "#2a2a4e" : "#d6cab2";

  return (
    <div className="letter-envelope-shell">
      <div className="envelope-header">
        <button onClick={onBack} className="env-back-btn">&larr; Edit Letter</button>
        <span className="env-title">Seal &amp; Send</span>
        <button
          className={`env-sign-btn ${signing ? "signing" : ""}`}
          onClick={() => setSigning(!signing)}
        >
          {signing ? "Done Signing" : "Add Signature"}
        </button>
      </div>

      <div className="envelope-body">
        <div className="envelope-preview">
          <svg ref={svgRef} className="envelope-svg" viewBox="0 0 500 420"
            onPointerDown={signing ? startSig : handleSealTap}
            onPointerMove={moveSig}
            onPointerUp={endSig}
            onPointerLeave={endSig}
            style={{ touchAction: "none" }}
          >
            <defs>
              <clipPath id="env-letter-peek">
                <rect x="68" y="24" width="364" height="156" rx="2" />
              </clipPath>
              <linearGradient id="env-mouth-shade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="rgba(60,40,15,0.35)" />
                <stop offset="1" stopColor="rgba(60,40,15,0)" />
              </linearGradient>
            </defs>

            {/* The letter, sliding into the envelope */}
            <rect x="64" y="20" width="372" height="170" rx="2" fill={paperFill} stroke={edgeStroke} strokeWidth="1" />
            <image
              href={letterImageUrl}
              x="68" y="24"
              width="364" height="260"
              preserveAspectRatio="xMidYMin slice"
              clipPath="url(#env-letter-peek)"
            />

            {/* Envelope body (back side, seams visible) */}
            <rect x="28" y="180" width="444" height="216" rx="6" fill={bodyFill} stroke={edgeStroke} strokeWidth="1.5" />
            <rect x="30" y="181" width="440" height="14" fill="url(#env-mouth-shade)" />
            <polygon points="30,182 250,300 30,394" fill={seamFill} stroke={edgeStroke} strokeWidth="1" />
            <polygon points="470,182 250,300 470,394" fill={seamFill} stroke={edgeStroke} strokeWidth="1" />
            <polygon points="30,394 250,292 470,394" fill={isMidnight ? "#1e1e34" : "#f0e8d6"} stroke={edgeStroke} strokeWidth="1" />

            {/* Midnight overlay — stars + moon */}
            {midnightOverlay && (
              <g opacity="0.3" dangerouslySetInnerHTML={{ __html: midnightOverlay }} />
            )}

            {/* Postage stamp, top-right of the envelope */}
            <g transform="translate(420, 215)">
              <rect x="-22" y="-26" width="44" height="54" rx="1" fill="#e8d5b0" stroke="#c0a880" strokeWidth="0.6" />
              <rect x="-19" y="-23" width="38" height="48" rx="1" fill="#f0e0c0" stroke="#c0a880" strokeWidth="0.4" />
              <text x="0" y="-8" textAnchor="middle" fill="#8b6914" fontSize="8" fontWeight="bold">5&#162;</text>
              <circle cx="0" cy="8" r="9" fill="none" stroke="#8b6914" strokeWidth="0.6" />
              <text x="0" y="11" textAnchor="middle" fill="#8b6914" fontSize="7">C</text>
            </g>

            {/* Ghost target where the seal would close the mouth */}
            {!envelopeData.waxSealSvg && !signing && (
              <g className="seal-ghost">
                <circle cx="250" cy="190" r="27" fill="none" stroke={envelopeData.waxSealColor} strokeWidth="1.5" strokeDasharray="4,4" />
                <text x="250" y="194" textAnchor="middle" fill={envelopeData.waxSealColor} fontSize="10" fontFamily="serif" fontStyle="italic">seal</text>
              </g>
            )}

            {/* Wax seal */}
            {envelopeData.waxSealSvg && (
              <g dangerouslySetInnerHTML={{ __html: envelopeData.waxSealSvg }} />
            )}

            {/* Signature strokes */}
            {signatureStrokes.map((d, i) => (
              <path key={`sig-${i}`} d={d}
                stroke={isMidnight ? "#e8e4f0" : "#1a1a2e"} strokeWidth="1.5" fill="none"
                strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
            ))}
            {currentSigPath && (
              <path d={currentSigPath}
                stroke={isMidnight ? "#e8e4f0" : "#1a1a2e"} strokeWidth="1.5" fill="none"
                strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
            )}

            {/* Address line (decorative) */}
            <text x="60" y="372" fill={isMidnight ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)"} fontSize="10" fontFamily="serif" fontStyle="italic">to the Caligraphia postbox</text>
          </svg>

          <p className="env-hint">
            {signing
              ? "Draw your signature anywhere on the envelope"
              : envelopeData.waxSealSvg
                ? "Tap your seal to lift it off, or tap elsewhere to re-press it"
                : "Tap the envelope to press your wax seal"}
          </p>
        </div>
      </div>

      <div className="envelope-footer">
        <div className="wax-colors">
          <span className="wax-label">Wax:</span>
          {WAX_COLORS.map((c) => (
            <button
              key={c}
              className={`wax-swatch ${envelopeData.waxSealColor === c ? "active" : ""}`}
              style={{ background: c }}
              onClick={() => pickWaxColor(c)}
              aria-label={`Wax color ${c}`}
            />
          ))}
        </div>
        <button onClick={handleSend} className="env-send-btn">
          <span className="send-icon">&#9993;</span> Send Letter
        </button>
      </div>

      <style>{`
        .letter-envelope-shell {
          max-width: 560px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          min-height: calc(100vh - 80px);
        }
        .envelope-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid var(--line, #e0d5c0);
          margin-bottom: 16px;
        }
        .env-back-btn {
          background: none;
          border: none;
          color: var(--muted, #8c7a60);
          cursor: pointer;
          font-size: 14px;
          font-family: inherit;
          padding: 6px 10px;
        }
        .env-back-btn:hover { color: #2c2416; }
        .env-title {
          font-size: 18px;
          font-weight: 700;
          color: #2c2416;
        }
        .env-sign-btn {
          padding: 6px 14px;
          border: 1.5px solid #c0a880;
          border-radius: 8px;
          background: transparent;
          cursor: pointer;
          font-size: 12px;
          font-family: inherit;
          color: #6b5c40;
          transition: all 0.15s;
        }
        .env-sign-btn.signing {
          background: #2c2416;
          color: var(--paper-bright, #fefdf9);
          border-color: #2c2416;
        }
        .envelope-body {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .envelope-preview {
          width: 100%;
          max-width: 500px;
        }
        .envelope-svg {
          width: 100%;
          height: auto;
          cursor: crosshair;
          border-radius: 8px;
        }
        .seal-ghost { animation: seal-pulse 2.2s ease-in-out infinite; }
        @keyframes seal-pulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.5; }
        }
        .env-hint {
          text-align: center;
          font-size: 12px;
          color: var(--muted, #8c7a60);
          font-style: italic;
          margin-top: 10px;
        }
        .envelope-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 0 24px;
          border-top: 1px solid var(--line, #e0d5c0);
          margin-top: 16px;
        }
        .wax-colors {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .wax-label {
          font-size: 12px;
          color: #6b5c40;
          font-weight: 500;
        }
        .wax-swatch {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          padding: 0;
          transition: transform 0.12s;
        }
        .wax-swatch.active {
          border-color: #333;
          transform: scale(1.25);
        }
        .wax-swatch:hover { transform: scale(1.15); }
        .env-send-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 28px;
          border: none;
          border-radius: 8px;
          background: var(--ink, #1a1a1a);
          color: #fff;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          font-family: inherit;
          box-shadow: 0 4px 16px rgba(0,0,0,0.18);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .env-send-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(0,0,0,0.18);
        }
        .send-icon { font-size: 18px; }
      `}</style>
    </div>
  );
}
