import { useState, useEffect } from "react";

export function useFadeIn(deps = []) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(false);
    // double-rAF: one frame to render invisible, next frame to fade in (~16-32ms vs 40ms)
    let id1, id2;
    id1 = requestAnimationFrame(() => { id2 = requestAnimationFrame(() => setVisible(true)); });
    return () => { cancelAnimationFrame(id1); cancelAnimationFrame(id2); };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return visible;
}

export function fadeStyle(visible) {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(8px)",
    transition: "opacity 0.18s ease, transform 0.18s ease",
    willChange: "opacity, transform",
  };
}
