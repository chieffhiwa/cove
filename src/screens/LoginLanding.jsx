import { useState } from "react";
import { supabase } from "../supabase";
import { useTheme } from "../context/ThemeContext";
import { useFadeIn, fadeStyle } from "../lib/hooks";

export function LoginLanding({ onLogin, onNewUser, darkMode, toggleDark }) {
  const C = useTheme();
  const visible = useFadeIn([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) { setAuthErr("Enter email and password."); return; }
    setLoading(true); setAuthErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setAuthErr(error.message); setLoading(false); }
    // on success, auth listener fires onLogin via setPhase
  };

  return (
    <div style={{ ...fadeStyle(visible), position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", padding: "48px 28px", textAlign: "center", background: C.bg, color: C.text }}>
      <button
        onClick={toggleDark}
        style={{ position: "absolute", top: 16, right: 18, background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.dim, padding: "6px 8px", lineHeight: 1 }}
        title={darkMode ? "switch to light" : "switch to dark"}
      >{darkMode ? "☀︎" : "☽"}</button>
      <div style={{ marginBottom: 44 }}>
        <div style={{ fontSize: 11, letterSpacing: 8, color: C.sky, fontFamily: "monospace", marginBottom: 28, opacity: 0.7 }}>
          C O V E
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 400, margin: "0 0 16px", color: C.pearl, lineHeight: 1.25, letterSpacing: -1 }}>
          Find work that<br />actually fits.
        </h1>
        <p style={{ fontSize: 14, color: C.mist, lineHeight: 1.85, margin: 0, maxWidth: 280 }}>
          your career. your current.
        </p>
      </div>

      <div style={{ width: "100%", maxWidth: 320, padding: "24px 22px", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, textAlign: "left" }}>
        <p style={{ fontSize: 10, letterSpacing: 3, color: C.ocean, fontFamily: "monospace", margin: "0 0 16px" }}>SIGN IN</p>
        <input
          type="email" placeholder="email" value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 13px", fontSize: 14, color: C.text, outline: "none", marginBottom: 8, fontFamily: "inherit" }}
        />
        <input
          type="password" placeholder="password" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSignIn()}
          style={{ width: "100%", boxSizing: "border-box", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 13px", fontSize: 14, color: C.text, outline: "none", marginBottom: authErr ? 8 : 14, fontFamily: "inherit" }}
        />
        {authErr && <div style={{ fontSize: 12, color: "#e07868", marginBottom: 10 }}>{authErr}</div>}
        <div
          onClick={handleSignIn}
          style={{ background: C.ocean, color: "#fff", textAlign: "center", padding: "12px 0", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "signing in..." : "sign in →"}
        </div>
      </div>

      <p style={{ fontSize: 13, color: C.muted, marginTop: 28 }}>
        New to Cove?{" "}
        <span onClick={onNewUser} style={{ color: C.ocean, cursor: "pointer", textDecoration: "underline" }}>
          Start here →
        </span>
      </p>
    </div>
  );
}
