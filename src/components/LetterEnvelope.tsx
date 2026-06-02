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
  const [signing, setSigning] = useState(false);
  const [signatureStrokes, setSignatureStrokes] = useState<any[]>([]);
  const [drawingSig, setDrawingSig] = useState(false);
  const [currentSigPath, setCurrentSigPath] = useState("");

  // Personal wax seal — generated once from username
  const personalSeal = useMemo(() => {
    if (username) {
      return generateWaxSealSvg(username, stampCount || 0);
    }
    return null;
  }, [username, stampCount]);

  // Midnight overlay
  const midnightOverlay = useMemo(() => {
    if (isMidnight) {
      return generateMidnightOverlay();
    }
    return null;
  }, [isMidnight]);

  const handleSealDraw = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const cursor = pt.matrixTransform(svg.getScreenCTM()!.inverse());

    // Draw wax seal as a stylized circle at click position
    const cx = envelopeData.stampX * 400;
    const cy = envelopeData.stampY * 500 + 100;
    const dist = Math.sqrt(
      (cursor.x - cx) ** 2 + (cursor.y - cy) ** 2
    );
    if (dist < 60) {
      // Remove seal
      setEnvelopeData((prev) => ({ ...prev, waxSealSvg: null }));
    } else {
      // Place seal
      const sealSvg = `<circle cx="${cursor.x}" cy="${cursor.y}" r="28" fill="${envelopeData.waxSealColor}" opacity="0.9"/>
        <circle cx="${cursor.x}" cy="${cursor.y}" r="22" fill="none" stroke="${envelopeData.waxSealColor}" stroke-width="2" opacity="0.5"/>
        <circle cx="${cursor.x}" cy="${cursor.y}" r="16" fill="none" stroke="${envelopeData.waxSealColor}" stroke-width="1.5" opacity="0.4"/>
        <text x="${cursor.x}" y="${cursor.y + 4}" text-anchor="middle" fill="#fff" font-size="10" font-family="serif" font-weight="bold">C</text>`;
      setEnvelopeData((prev) => ({ ...prev, waxSealSvg: sealSvg }));
    }
  };

  const startSig = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || !signing) return;
    svgRef.current.setPointerCapture(e.pointerId);
    setDrawingSig(true);
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const cursor = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    setCurrentSigPath(`M${cursor.x},${cursor.y}`);
  };

  const moveSig = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawingSig || !signing || !svgRef.current) return;
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const cursor = pt.matrixTransform(svg.getScreenCTM()!.inverse());
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

  return (
    <div className="letter-envelope-shell">
      <div className="envelope-header">
        <button onClick={onBack} className="env-back-btn">&larr; Edit Letter</button>
        <span className="env-title">Seal & Send</span>
        <button
          className={`env-sign-btn ${signing ? "signing" : ""}`}
          onClick={() => setSigning(!signing)}
        >
          {signing ? "Done Signing" : "Add Signature"}
        </button>
      </div>

      <div className="envelope-body">
        <div className="envelope-preview">
          <svg ref={svgRef} className="envelope-svg" viewBox="0 0 500 400"
            onPointerDown={signing ? startSig : handleSealDraw}
            onPointerMove={moveSig}
            onPointerUp={endSig}
            onPointerLeave={endSig}
            style={{ touchAction: "none" }}
          >
            {/* Envelope body */}
            <rect x="20" y="30" width="460" height="340" rx="6" fill="#f5f0e8" stroke="#d0c8b8" strokeWidth="2"/>

            {/* Envelope flap (triangle) */}
            <polygon points="250,30 20,370 480,370" fill={isMidnight ? "#1a1a2e" : "#ede4d0"} stroke={isMidnight ? "#2a2a4e" : "#d0c8b8"} strokeWidth="1.5"/>

            {/* Midnight overlay — stars + moon */}
            {midnightOverlay && (
              <g opacity="0.3" dangerouslySetInnerHTML={{ __html: midnightOverlay }} />
            )}

            {/* Personal wax seal on the flap */}
            {personalSeal && (
              <g transform="translate(235, 180) scale(0.7)" opacity="0.6">
                <g dangerouslySetInnerHTML={{ __html: personalSeal }} />
              </g>
            )}

            {/* Letter peek-through (scaled down letter image) */}
            <image
              href={letterImageUrl}
              x="70" y="80"
              width="360" height="240"
              preserveAspectRatio="xMidYMid slice"
              opacity="0.85"
              clipPath="url(#letterClip)"
            />
            <clipPath id="letterClip">
              <rect x="70" y="80" width="360" height="240" rx="3"/>
            </clipPath>

            {/* Letter edge shadow */}
            <rect x="70" y="80" width="360" height="240" rx="3"
              fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1"/>

            {/* Stamp placement zone */}
            {(() => {
              const sx = envelopeData.stampX * 400;
              const sy = envelopeData.stampY * 500 + 30;
              return (
                <g>
                  <rect x={sx - 25} y={sy - 35} width="50" height="60" rx="2"
                    fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1"
                    strokeDasharray="3,3" />
                  <text x={sx} y={sy - 20} textAnchor="middle" fill="rgba(0,0,0,0.2)" fontSize="8">STAMP</text>
                  {/* Stamp design */}
                  {sx > 0 && (
                    <g transform={`translate(${sx},${sy})`}>
                      <rect x="-20" y="-30" width="40" height="50" rx="1"
                        fill="#e8d5b0" stroke="#c0a880" strokeWidth="0.5"/>
                      <rect x="-18" y="-28" width="36" height="46" rx="1"
                        fill="#f0e0c0" stroke="#c0a880" strokeWidth="0.3"/>
                      <text x="0" y="-5" textAnchor="middle" fill="#8b6914" fontSize="7" fontWeight="bold">5¢</text>
                      <circle cx="0" cy="6" r="8" fill="none" stroke="#8b6914" strokeWidth="0.5"/>
                      <text x="0" y="9" textAnchor="middle" fill="#8b6914" fontSize="6">C</text>
                      <line x1="-15" y1="-25" x2="15" y2="-25" stroke="#c0a880" strokeWidth="0.3"/>
                      <line x1="-15" y1="18" x2="15" y2="18" stroke="#c0a880" strokeWidth="0.3"/>
                    </g>
                  )}
                </g>
              );
            })()}

            {/* Wax seal */}
            {envelopeData.waxSealSvg && (
              <g dangerouslySetInnerHTML={{ __html: envelopeData.waxSealSvg }} />
            )}

            {/* Signature area */}
            {signatureStrokes.map((d, i) => (
              <path key={`sig-${i}`} d={d}
                stroke="#1a1a2e" strokeWidth="1.5" fill="none"
                strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
            ))}
            {currentSigPath && (
              <path d={currentSigPath}
                stroke="#1a1a2e" strokeWidth="1.5" fill="none"
                strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
            )}

            {/* Address lines (decorative) */}
            <text x="120" y="230" fill="rgba(0,0,0,0.15)" fontSize="8" fontFamily="serif">To the Caligraphia community,</text>
            <text x="120" y="245" fill="rgba(0,0,0,0.1)" fontSize="7" fontFamily="serif">c/o The Postbox</text>
          </svg>

          <p className="env-hint">
            {signing
              ? "Draw your signature at the bottom of the letter"
              : "Tap to place a wax seal on the envelope flap (tap an existing seal to remove it)"}
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
              onClick={() => setEnvelopeData((prev) => ({ ...prev, waxSealColor: c }))}
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
          border-bottom: 1px solid #e0d5c0;
          margin-bottom: 16px;
        }
        .env-back-btn {
          background: none;
          border: none;
          color: #8c7a60;
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
          border-radius: 16px;
          background: transparent;
          cursor: pointer;
          font-size: 12px;
          font-family: inherit;
          color: #6b5c40;
          transition: all 0.15s;
        }
        .env-sign-btn.signing {
          background: #2c2416;
          color: #fefdf9;
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
          box-shadow: 0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04);
        }
        .env-hint {
          text-align: center;
          font-size: 12px;
          color: #8c7a60;
          font-style: italic;
          margin-top: 10px;
        }
        .envelope-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 0 24px;
          border-top: 1px solid #e0d5c0;
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
          border-radius: 24px;
          background: linear-gradient(135deg, #2c3e50, #c0392b);
          color: #fff;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          font-family: inherit;
          box-shadow: 0 4px 16px rgba(192,57,43,0.25);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .env-send-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(192,57,43,0.35);
        }
        .send-icon { font-size: 18px; }
      `}</style>
    </div>
  );
}
