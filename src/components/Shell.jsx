import { useTheme } from "../context/ThemeContext";
import { DARK, getDepthPalette } from "../config/palette";

export function Shell({ children, depth }) {
  const C = useTheme();
  const isDark = C === DARK;
  const d = (depth != null && !isDark) ? getDepthPalette(depth) : null;
  const bg = d ? d.bg : C.bg;
  return (
    <div style={{
      background: bg,
      backgroundImage: `radial-gradient(ellipse at 50% 30%, ${d ? d.accent : C.oceanDeep}18 0%, transparent 70%)`,
      minHeight: "100vh",
      color: d ? d.text : C.text,
      fontFamily: "'Georgia', 'Times New Roman', serif",
      fontSize: "16px",
      maxWidth: 480, margin: "0 auto",
      position: "relative",
      transition: "background 0.8s ease, color 0.8s ease",
    }}>
      {children}
    </div>
  );
}
