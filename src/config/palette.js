// ─── PALETTE ─────────────────────────────────────────────────────────────────
// Two colour themes (light / dark) and a depth-based gradient system used
// during onboarding to subtly shift the background as users progress.

export const LIGHT = {
  bg:         "#eff6ff",
  surface:    "#fafcff",
  raised:     "#e0edff",
  border:     "#c2d6f5",
  borderSoft: "#d8e8f8",
  text:       "#0f1e30",
  muted:      "#4a607a",
  faint:      "#d0e4f8",
  dim:        "#6070a0",
  ocean:      "#2563eb",
  oceanDeep:  "#1d4ed8",
  seafoam:    "#10b981",
  sky:        "#3b82f6",
  mist:       "#5870a0",
  tide:       "#2563eb",
  pearl:      "#0f172a",
};

export const DARK = {
  bg:         "#0c1526",
  surface:    "#101f32",
  raised:     "#162334",
  border:     "#1e3050",
  borderSoft: "#1a2c48",
  text:       "#cce0f8",
  muted:      "#6898c0",
  faint:      "#162334",
  dim:        "#4a70a8",
  ocean:      "#38bdf8",
  oceanDeep:  "#0ea5e9",
  seafoam:    "#2dd4b0",
  sky:        "#7dd3fc",
  mist:       "#6490b8",
  tide:       "#0ea5e9",
  pearl:      "#f0f9ff",
};

// ─── DEPTH PALETTE ────────────────────────────────────────────────────────────
// As the user moves through onboarding (steps 0–17), the water clears.
// Deep/murky → mid-depth → clearing → surface light.

export function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
export function lerpHex(c1, c2, t) {
  const p = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
  const [r1,g1,b1] = p(c1); const [r2,g2,b2] = p(c2);
  return `#${[lerp(r1,r2,t),lerp(g1,g2,t),lerp(b1,b2,t)].map(v=>v.toString(16).padStart(2,"0")).join("")}`;
}

export const DEPTH_STOPS = [
  { bg: "#eff6ff", text: "#0f1e30", accent: "#2563eb" },   // 0
  { bg: "#e8f0ff", text: "#0d1a28", accent: "#1d4ed8" },   // 6
  { bg: "#dce8fa", text: "#0a1620", accent: "#1e40af" },   // 11
  { bg: "#d0dff5", text: "#07101a", accent: "#1e3a8a" },   // 17
];

export function getDepthPalette(step) {
  const TOTAL = 19;
  const t = Math.min(step, TOTAL) / TOTAL;
  const stops = DEPTH_STOPS;
  const seg = (stops.length - 1) * t;
  const i = Math.min(Math.floor(seg), stops.length - 2);
  const local = seg - i;
  return {
    bg:     lerpHex(stops[i].bg,     stops[i+1].bg,     local),
    text:   lerpHex(stops[i].text,   stops[i+1].text,   local),
    accent: lerpHex(stops[i].accent, stops[i+1].accent, local),
  };
}
