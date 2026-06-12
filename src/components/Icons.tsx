"use client";

// Small inline SVG icon set used across the app.
// Replaces bare-Unicode glyphs (✎ ✍ ▲ ▼ ★ ✉ ▶) that render as
// outlined/box "triangles" on many mobile system fonts.

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const base = (size = 16): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
});

export function PencilIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} aria-hidden="true">
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.586 7.586" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  );
}

export function EnvelopeIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

export function StarIcon({ size = 16, className, style, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(size)} className={className} style={style} fill={filled ? "currentColor" : "none"} aria-hidden="true">
      <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2" />
    </svg>
  );
}

export function ThumbUpIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} aria-hidden="true">
      <path d="M7 22V11" />
      <path d="M3 11h4v11H3z" />
      <path d="M7 11l4-7c.8-1.5 3-1 3 1v4h5a2 2 0 0 1 2 2.3l-1.3 6A2 2 0 0 1 17.7 19H7" />
    </svg>
  );
}

export function ThumbDownIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} aria-hidden="true">
      <path d="M17 2v11" />
      <path d="M21 13h-4V2h4z" />
      <path d="M17 13l-4 7c-.8 1.5-3 1-3-1v-4H5a2 2 0 0 1-2-2.3l1.3-6A2 2 0 0 1 6.3 5H17" />
    </svg>
  );
}

export function PlayIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} fill="currentColor" aria-hidden="true">
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}

export function CameraIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

export function CheckIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} aria-hidden="true">
      <path d="M5 12l5 5 9-11" />
    </svg>
  );
}

export function ArrowUpIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} aria-hidden="true">
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}

export function ArrowLeftIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} aria-hidden="true">
      <path d="M19 12H5" />
      <path d="M12 5l-7 7 7 7" />
    </svg>
  );
}

export function ScratchIcon({ size = 16, className, style }: IconProps) {
  // A small "speech / scribble" mark — for scratch/comment count.
  return (
    <svg {...base(size)} className={className} style={style} aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 1 1 21 11.5z" />
    </svg>
  );
}

export function CircleIcon({ size = 16, className, style }: IconProps) {
  // Generic "circles" / groups icon
  return (
    <svg {...base(size)} className={className} style={style} aria-hidden="true">
      <circle cx="9" cy="12" r="5" />
      <circle cx="16" cy="12" r="5" />
    </svg>
  );
}
