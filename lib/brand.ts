export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

export function mix(a: string, b: string, ratio: number): string {
  const A = hexToRgb(a), B = hexToRgb(b);
  const r = A.r + (B.r - A.r) * ratio;
  const g = A.g + (B.g - A.g) * ratio;
  const bl = A.b + (B.b - A.b) * ratio;
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`.toUpperCase();
}

export function readableText(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#1E1E1E' : '#FFFFFF';
}

export interface DerivedBrand {
  primary: string; primaryLight: string; primaryDark: string; onPrimary: string;
  accent: string; accentLight: string; onAccent: string;
}

export function deriveBrand(primary: string, accent: string): DerivedBrand {
  return {
    primary,
    primaryLight: mix(primary, '#FFFFFF', 0.25),
    primaryDark: mix(primary, '#000000', 0.25),
    onPrimary: readableText(primary),
    accent,
    accentLight: mix(accent, '#FFFFFF', 0.25),
    onAccent: readableText(accent),
  };
}

// Marque active (mutable), init = défauts AeroGo. Peuplée au lancement (Task 6).
export const activeBrand: DerivedBrand = deriveBrand('#C0102E', '#1E1E1E');

export function applyBrand(primary: string, accent: string): void {
  Object.assign(activeBrand, deriveBrand(primary, accent));
}
