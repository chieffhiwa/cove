import { useState } from "react";
import { useTheme } from "../context/ThemeContext";

export function Btn({ children, onClick, disabled, style }) {
  const C = useTheme();
  const [pressed, setPressed] = useState(false);
  const handleClick = (e) => {
    if (disabled) return;
    if (navigator.vibrate) navigator.vibrate(10);
    onClick?.(e);
  };
  return (
    <div
      onClick={handleClick}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => !disabled && setPressed(true)}
      onTouchEnd={() => { setPressed(false); }}
      style={{
        width: "100%", padding: "17px", borderRadius: 14,
        background: disabled ? C.faint : `linear-gradient(135deg, ${C.tide}, ${C.ocean})`,
        color: disabled ? C.muted : "#f0f8ff",
        fontSize: 15, textAlign: "center", cursor: disabled ? "default" : "pointer",
        transition: "opacity 0.15s, transform 0.1s, box-shadow 0.15s",
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        transform: pressed && !disabled ? "scale(0.97)" : "scale(1)",
        boxShadow: pressed ? `0 1px 6px ${C.ocean}18` : `0 4px 20px ${C.ocean}28`,
        fontFamily: "Georgia, serif",
        letterSpacing: 0.3,
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
        boxSizing: "border-box",
        border: `1px solid ${C.ocean}30`,
        ...style,
      }}
    >{children}</div>
  );
}
