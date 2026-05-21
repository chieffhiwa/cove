// ─── SHARED MUTABLE THEME REFERENCE ──────────────────────────────────────────
// `C` is set at render-time in AppInner (App.jsx) via `setC(darkMode ? DARK : LIGHT)`.
// All components import `C` from here so they always see the current palette.
// This preserves the original mutable-global pattern without changing behaviour.

import { LIGHT } from "../config/palette";

export let C = LIGHT;

export function setC(palette) {
  C = palette;
}
