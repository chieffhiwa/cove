import { useTheme } from "../context/ThemeContext";

export function Avatar({ name, size = 36, glow = false }) {
  const C = useTheme();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `linear-gradient(150deg, ${C.oceanDeep}, ${C.tide})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 600, color: C.pearl,
      boxShadow: glow ? `0 0 24px ${C.ocean}40` : "none",
    }}>{name[0]}</div>
  );
}
