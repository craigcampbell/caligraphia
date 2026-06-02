// Generate a unique personal wax seal SVG based on a username and stamp count.
// The seal evolves visually as the user earns more stamps.

const SEAL_TIERS = [
  { minStamps: 0,  border: "#8b4513", label: "Wax",     rings: 1, fontSize: 11 },
  { minStamps: 10, border: "#c0a060", label: "Bronze",  rings: 2, fontSize: 12 },
  { minStamps: 50, border: "#c0c0c0", label: "Silver",  rings: 3, fontSize: 13 },
  { minStamps: 200,border: "#d4a017", label: "Gold",    rings: 4, fontSize: 14 },
  { minStamps: 1000,border: "#b9f2ff",label: "Diamond", rings: 5, fontSize: 15 },
];

function getInitials(username: string): string {
  const parts = username.replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return username.slice(0, 2).toUpperCase();
}

function hashColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = ((hash << 5) - hash) + username.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 35%)`;
}

export function generateWaxSealSvg(
  username: string,
  stampCount: number,
  waxColor?: string
): string {
  const tier = [...SEAL_TIERS].reverse().find((t) => stampCount >= t.minStamps) || SEAL_TIERS[0];
  const initials = getInitials(username);
  const baseColor = waxColor || hashColor(username);
  const cx = 30;
  const cy = 30;
  const baseR = 24 - (5 - tier.rings);
  const r = baseR + (tier.rings - 1) * 1.5;

  let rings = "";
  for (let i = 0; i < tier.rings; i++) {
    const ringR = r - i * 3;
    rings += `<circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none" stroke="${tier.border}" stroke-width="${0.5 + i * 0.3}" opacity="${0.5 + i * 0.1}"/>`;
  }

  // Decorative dots around the seal
  let dots = "";
  const numDots = 6 + tier.rings * 2;
  for (let i = 0; i < numDots; i++) {
    const angle = (i / numDots) * Math.PI * 2;
    const dotR = r - 2;
    const dx = cx + Math.cos(angle) * dotR;
    const dy = cy + Math.sin(angle) * dotR;
    dots += `<circle cx="${dx}" cy="${dy}" r="1.2" fill="${tier.border}" opacity="0.6"/>`;
  }

  // Ribbon/banner
  const ribbon = `<rect x="${cx - initials.length * 4 - 3}" y="${cy - 3}" width="${initials.length * 8 + 6}" height="8" rx="1" fill="${baseColor}" opacity="0.85"/>
    <text x="${cx}" y="${cy + 3}" text-anchor="middle" fill="#fff" font-size="${tier.fontSize}" font-family="serif" font-weight="bold">${initials}</text>`;

  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${baseColor}" opacity="0.9"/>
    ${rings}
    ${dots}
    ${ribbon}
  `;
}

// Generate a moon/stars SVG for midnight mode
export function generateMidnightOverlay(): string {
  const elements: string[] = [];
  // Stars
  for (let i = 0; i < 12; i++) {
    const sx = 20 + Math.random() * 460;
    const sy = 20 + Math.random() * 340;
    const sr = 1 + Math.random() * 2;
    elements.push(`<circle cx="${sx}" cy="${sy}" r="${sr}" fill="#fff" opacity="${0.15 + Math.random() * 0.25}"/>`);
  }
  // Crescent moon
  elements.push(`<circle cx="420" cy="60" r="18" fill="#fff" opacity="0.08"/>`);
  elements.push(`<circle cx="426" cy="54" r="14" fill="#f5f0e8" opacity="1"/>`);
  return elements.join("\n");
}
