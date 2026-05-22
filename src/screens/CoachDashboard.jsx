import { useState } from "react";
import { supabase } from "../supabase";
import { useTheme } from "../context/ThemeContext";
import { QUADRANT_READS } from "../config/quadrants";
import { Btn } from "../components/Btn";

const COACH_PASSWORD = process.env.REACT_APP_COACH_PASSWORD || "cove2026";

function CoachStatCard({ label, value, mono, valueColor, small }) {
  const C = useTheme();
  return (
    <div style={{ flex: "1 1 120px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ ...mono, fontSize: 9, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: small ? 13 : 28, color: valueColor || C.pearl, fontWeight: 400, fontFamily: small ? "monospace" : "Georgia, serif", lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}

function CoachMetaRow({ label, value, mono, dim }) {
  const C = useTheme();
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
      <span style={{ ...mono, fontSize: 10, color: C.muted, minWidth: 60, textAlign: "right", flexShrink: 0 }}>{label}</span>
      <span style={{ ...mono, fontSize: 10, color: dim ? C.dim : C.text, wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

export function CoachDashboard() {
  const C = useTheme();
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [reflections, setReflections] = useState(null);
  const [profiles, setProfiles] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [filterQ, setFilterQ] = useState("all");
  const [view, setView] = useState("reflections");

  const handleLogin = () => {
    if (pw === COACH_PASSWORD) {
      setAuthed(true);
      setPwError(false);
      setLoading(true);
      Promise.all([
        supabase
          .from("reflections")
          .select("id, name, phone, quadrant, brave_reflection, fears_reflection, ref, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, name, email, linkedin, quadrant, x, y, created_at, updated_at")
          .order("created_at", { ascending: false }),
      ]).then(([{ data: rData }, { data: pData }]) => {
        if (rData) setReflections(rData);
        if (pData) setProfiles(pData);
        setLoading(false);
      });
    } else {
      setPwError(true);
    }
  };

  const goBack = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("coach");
    window.location.href = url.toString();
  };

  const handleDelete = async (id) => {
    setDeleting(true);
    const { error } = await supabase.from("reflections").delete().eq("id", id);
    if (!error) {
      setReflections(prev => prev.filter(r => r.id !== id));
      if (selected?.id === id) setSelected(null);
      setDeleteTarget(null);
    }
    setDeleting(false);
  };

  const mono = { fontFamily: "monospace" };

  // ── Auth screen ──────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{
        background: C.bg, minHeight: "100vh", color: C.text,
        fontFamily: "Georgia, serif", display: "flex",
        flexDirection: "column", justifyContent: "center", alignItems: "center",
        padding: "48px 32px",
      }}>
        <div style={{ width: "100%", maxWidth: 360 }}>
          <div style={{ ...mono, fontSize: 11, color: C.muted, letterSpacing: 3, marginBottom: 20 }}>COACH ACCESS</div>
          <h2 style={{ fontSize: 22, fontWeight: 400, color: C.pearl, margin: "0 0 24px" }}>Enter password</h2>
          <input
            type="password"
            autoFocus
            value={pw}
            onChange={e => { setPw(e.target.value); setPwError(false); }}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            placeholder="password"
            style={{
              width: "100%", background: C.surface,
              border: `1px solid ${pwError ? "#e05a5a" : C.border}`,
              borderRadius: 10, padding: "14px 16px", fontSize: 15,
              color: C.pearl, outline: "none", ...mono,
              boxSizing: "border-box", marginBottom: 12,
            }}
          />
          {pwError && (
            <div style={{ fontSize: 12, color: "#e05a5a", ...mono, marginBottom: 12 }}>incorrect password</div>
          )}
          <Btn onClick={handleLogin}>Unlock</Btn>
          <button
            onClick={goBack}
            style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", marginTop: 20, display: "block", ...mono }}
          >
            back to app
          </button>
        </div>
      </div>
    );
  }

  // ── Compute stats ────────────────────────────────────────────────────────────
  const total = reflections ? reflections.length : 0;

  const quadrantCounts = {};
  if (reflections) {
    reflections.forEach(r => {
      const q = r.quadrant || "Unknown";
      quadrantCounts[q] = (quadrantCounts[q] || 0) + 1;
    });
  }
  const quadrantRows = Object.entries(quadrantCounts)
    .map(([title, count]) => {
      const key = Object.keys(QUADRANT_READS).find(k => QUADRANT_READS[k].title === title);
      return { title, count, pct: total ? Math.round((count / total) * 100) : 0, color: key ? QUADRANT_READS[key].color : C.muted };
    })
    .sort((a, b) => b.count - a.count);

  // Weekly buckets — last 12 weeks
  const now = new Date();
  const weekBuckets = Array.from({ length: 12 }, (_, i) => {
    const end = new Date(now);
    end.setDate(now.getDate() - (11 - i) * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 7);
    const label = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { start, end, count: 0, label };
  });
  if (reflections) {
    reflections.forEach(r => {
      if (!r.created_at) return;
      const d = new Date(r.created_at);
      for (const b of weekBuckets) {
        if (d >= b.start && d < b.end) { b.count++; break; }
      }
    });
  }
  const lastWeek = weekBuckets[weekBuckets.length - 1].count;
  const prevWeek = weekBuckets[weekBuckets.length - 2].count;
  const growthRate = prevWeek === 0
    ? (lastWeek > 0 ? "+∞" : "—")
    : `${lastWeek >= prevWeek ? "+" : ""}${Math.round(((lastWeek - prevWeek) / prevWeek) * 100)}%`;
  const growthColor = lastWeek >= prevWeek ? C.seafoam : "#e07868";

  // Monthly buckets — last 6 months
  const monthBuckets = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { label: d.toLocaleDateString("en-US", { month: "short" }), year: d.getFullYear(), month: d.getMonth(), count: 0 };
  });
  if (reflections) {
    reflections.forEach(r => {
      if (!r.created_at) return;
      const d = new Date(r.created_at);
      const b = monthBuckets.find(m => m.year === d.getFullYear() && m.month === d.getMonth());
      if (b) b.count++;
    });
  }

  // Filtered list
  const filtered = (reflections || []).filter(r => filterQ === "all" || r.quadrant === filterQ);

  // ── SVG weekly line chart ────────────────────────────────────────────────────
  const CW = 600, CH = 100, pL = 26, pR = 12, pT = 10, pB = 22;
  const wMax = Math.max(...weekBuckets.map(b => b.count), 1);
  const wPts = weekBuckets.map((b, i) => ({
    x: pL + (i / (weekBuckets.length - 1)) * (CW - pL - pR),
    y: pT + (1 - b.count / wMax) * (CH - pT - pB),
    ...b,
  }));
  const wLine = wPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const wArea = `${wLine} L${wPts[wPts.length - 1].x.toFixed(1)},${(CH - pB).toFixed(1)} L${wPts[0].x.toFixed(1)},${(CH - pB).toFixed(1)}Z`;

  // ── SVG monthly bar chart ────────────────────────────────────────────────────
  const BW = 600, BH = 80, bpT = 8, bpB = 20, bpL = 24, bpR = 12;
  const mMax = Math.max(...monthBuckets.map(b => b.count), 1);
  const slot = (BW - bpL - bpR) / monthBuckets.length;
  const bw = slot * 0.55;

  return (
    <div style={{
      background: C.bg, minHeight: "100vh", color: C.text,
      fontFamily: "Georgia, serif", padding: "40px 28px 80px",
      maxWidth: 720, margin: "0 auto", position: "relative",
    }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36 }}>
        <div>
          <div style={{ ...mono, fontSize: 11, color: C.muted, letterSpacing: 3, marginBottom: 8 }}>COVE / COACH VIEW</div>
          <h1 style={{ fontSize: 24, fontWeight: 400, color: C.pearl, margin: 0 }}>Dashboard</h1>
        </div>
        <button onClick={goBack} style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", ...mono, padding: 0, paddingTop: 4 }}>
          ← back
        </button>
      </div>

      {/* View toggle */}
      {!loading && (reflections || profiles) && (
        <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
          {["reflections", "profiles"].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                background: view === v ? `${C.ocean}20` : "none",
                border: `1px solid ${view === v ? C.ocean : C.border}`,
                borderRadius: 20, padding: "5px 16px",
                color: view === v ? C.ocean : C.muted,
                fontSize: 11, cursor: "pointer", ...mono, transition: "all 0.15s",
              }}
            >{v}</button>
          ))}
        </div>
      )}

      {loading && <div style={{ ...mono, fontSize: 12, color: C.dim, letterSpacing: 1 }}>loading...</div>}

      {!loading && view === "profiles" && profiles && (
        <ProfilesView profiles={profiles} C={C} mono={mono} QUADRANT_READS={QUADRANT_READS} />
      )}

      {!loading && view === "reflections" && reflections && (
        <>
          {/* ── Stat cards ── */}
          <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
            <CoachStatCard label="total users"   value={total}      mono={mono} />
            <CoachStatCard label="this week"     value={lastWeek}   mono={mono} />
            <CoachStatCard label="wk/wk growth"  value={growthRate} mono={mono} valueColor={growthColor} />
            {quadrantRows[0] && (
              <CoachStatCard label="top quadrant" value={quadrantRows[0].title} mono={mono} valueColor={quadrantRows[0].color} small />
            )}
          </div>

          {/* ── Weekly line chart ── */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px 10px", marginBottom: 16 }}>
            <div style={{ ...mono, fontSize: 9, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>weekly signups — last 12 weeks</div>
            <svg viewBox={`0 0 ${CW} ${CH}`} style={{ width: "100%", height: CH, display: "block", overflow: "visible" }}>
              {[0, 0.5, 1].map((t, i) => {
                const y = pT + (1 - t) * (CH - pT - pB);
                return <line key={i} x1={pL} x2={CW - pR} y1={y} y2={y} stroke={C.border} strokeWidth={0.5} />;
              })}
              {[0, Math.ceil(wMax / 2), wMax].map((v, i) => {
                const y = pT + (1 - v / wMax) * (CH - pT - pB);
                return <text key={i} x={pL - 4} y={y + 3} textAnchor="end" fontSize={7} fill={C.muted} fontFamily="monospace">{v}</text>;
              })}
              <path d={wArea} fill={`${C.ocean}12`} />
              <path d={wLine} fill="none" stroke={C.ocean} strokeWidth={1.5} strokeLinejoin="round" />
              {wPts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={p.count > 0 ? C.ocean : C.border} />)}
              {wPts.filter((_, i) => i % 3 === 0 || i === wPts.length - 1).map((p, i) => (
                <text key={i} x={p.x} y={CH - 5} textAnchor="middle" fontSize={7} fill={C.muted} fontFamily="monospace">{p.label}</text>
              ))}
            </svg>
          </div>

          {/* ── Monthly bar chart ── */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px 10px", marginBottom: 16 }}>
            <div style={{ ...mono, fontSize: 9, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>monthly cohorts — last 6 months</div>
            <svg viewBox={`0 0 ${BW} ${BH}`} style={{ width: "100%", height: BH, display: "block" }}>
              {monthBuckets.map((b, i) => {
                const bh = Math.max((b.count / mMax) * (BH - bpT - bpB), b.count > 0 ? 2 : 0);
                const bx = bpL + i * slot + (slot - bw) / 2;
                const by = BH - bpB - bh;
                return (
                  <g key={i}>
                    <rect x={bx} y={by} width={bw} height={bh} rx={3} fill={C.ocean} opacity={0.65} />
                    <text x={bx + bw / 2} y={BH - 6} textAnchor="middle" fontSize={8} fill={C.muted} fontFamily="monospace">{b.label}</text>
                    {b.count > 0 && <text x={bx + bw / 2} y={by - 3} textAnchor="middle" fontSize={8} fill={C.ocean} fontFamily="monospace">{b.count}</text>}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* ── Quadrant distribution bars ── */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 22px", marginBottom: 28 }}>
            <div style={{ ...mono, fontSize: 9, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>quadrant distribution</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {quadrantRows.map(qr => (
                <div key={qr.title}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ ...mono, fontSize: 10, color: qr.color }}>{qr.title}</span>
                    <span style={{ ...mono, fontSize: 10, color: C.muted }}>{qr.count} · {qr.pct}%</span>
                  </div>
                  <div style={{ height: 4, background: C.faint, borderRadius: 2 }}>
                    <div style={{ height: 4, width: `${qr.pct}%`, background: qr.color, borderRadius: 2, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Entries list ── */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div style={{ ...mono, fontSize: 9, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase" }}>
                entries ({filtered.length}{filterQ !== "all" ? " filtered" : ""})
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[{ value: "all", label: "All", color: C.ocean }, ...Object.values(QUADRANT_READS).map(q => ({ value: q.title, label: q.title.split(" ")[0], color: q.color }))].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterQ(opt.value)}
                    style={{
                      background: filterQ === opt.value ? `${opt.color}20` : "none",
                      border: `1px solid ${filterQ === opt.value ? opt.color : C.border}`,
                      borderRadius: 20, padding: "3px 10px",
                      color: filterQ === opt.value ? opt.color : C.muted,
                      fontSize: 10, cursor: "pointer", ...mono, transition: "all 0.15s",
                    }}
                  >{opt.label}</button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map(r => {
                const key = Object.keys(QUADRANT_READS).find(k => QUADRANT_READS[k].title === r.quadrant);
                const color = key ? QUADRANT_READS[key].color : C.muted;
                const date = r.created_at ? new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelected(r)}
                    style={{
                      background: C.surface, border: `1px solid ${C.border}`,
                      borderLeft: `3px solid ${color}`, borderRadius: 10, padding: "14px 16px",
                      cursor: "pointer", transition: "background 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = C.raised}
                    onMouseLeave={e => e.currentTarget.style.background = C.surface}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 12, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, color: C.pearl, fontWeight: 500 }}>{r.name || "Anonymous"}</span>
                        <span style={{ ...mono, fontSize: 10, color, letterSpacing: 0.5 }}>{r.quadrant || "Unknown"}</span>
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ ...mono, fontSize: 10, color: C.dim }}>{date}</span>
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteTarget(r.id); }}
                          title="Delete entry"
                          style={{ background: "none", border: "none", color: C.muted, fontSize: 11, cursor: "pointer", ...mono, padding: "2px 6px", borderRadius: 4, transition: "color 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.color = "#e07868"}
                          onMouseLeave={e => e.currentTarget.style.color = C.muted}
                        >✕</button>
                      </div>
                    </div>
                    {r.brave_reflection && (
                      <div style={{ marginBottom: 4 }}>
                        <span style={{ ...mono, fontSize: 9, color: C.seafoam, letterSpacing: 1, textTransform: "uppercase" }}>brave: </span>
                        <span style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>
                          {r.brave_reflection.length > 90 ? r.brave_reflection.slice(0, 90) + "…" : r.brave_reflection}
                        </span>
                      </div>
                    )}
                    {r.fears_reflection && (
                      <div>
                        <span style={{ ...mono, fontSize: 9, color: C.ocean, letterSpacing: 1, textTransform: "uppercase" }}>fears: </span>
                        <span style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>
                          {r.fears_reflection.length > 90 ? r.fears_reflection.slice(0, 90) + "…" : r.fears_reflection}
                        </span>
                      </div>
                    )}
                    <div style={{ ...mono, fontSize: 9, color: C.dim, marginTop: 6 }}>tap to explore →</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Entry detail overlay (bottom sheet) ── */}
      {selected && (
        <div
          onClick={() => { setSelected(null); setDeleteTarget(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: C.raised, border: `1px solid ${C.border}`,
              borderRadius: "20px 20px 0 0", padding: "24px 28px 48px",
              width: "100%", maxWidth: 680, maxHeight: "88vh", overflowY: "auto",
            }}
          >
            <div style={{ width: 36, height: 3, background: C.border, borderRadius: 2, margin: "0 auto 22px" }} />
            {(() => {
              const key = Object.keys(QUADRANT_READS).find(k => QUADRANT_READS[k].title === selected.quadrant);
              const color = key ? QUADRANT_READS[key].color : C.muted;
              const date = selected.created_at
                ? new Date(selected.created_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
                : "";
              return (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                    <div>
                      <div style={{ fontSize: 20, color: C.pearl, fontWeight: 500, marginBottom: 4 }}>{selected.name || "Anonymous"}</div>
                      <div style={{ ...mono, fontSize: 10, color, letterSpacing: 1 }}>{selected.quadrant || "Unknown quadrant"}</div>
                    </div>
                    <button onClick={() => { setSelected(null); setDeleteTarget(null); }} style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer", ...mono, padding: 0 }}>✕</button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 22 }}>
                    {selected.phone && <CoachMetaRow label="email" value={selected.phone} mono={mono} />}
                    <CoachMetaRow label="date" value={date} mono={mono} />
                    <CoachMetaRow label="ref" value={selected.ref || "direct"} mono={mono} />
                    <CoachMetaRow label="id" value={String(selected.id)} mono={mono} dim />
                  </div>

                  <div style={{ height: 1, background: C.border, marginBottom: 22 }} />

                  {selected.brave_reflection && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ ...mono, fontSize: 9, color: C.seafoam, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>brave decision</div>
                      <div style={{ fontSize: 15, color: C.text, lineHeight: 1.75, fontStyle: "italic" }}>"{selected.brave_reflection}"</div>
                    </div>
                  )}

                  {selected.fears_reflection && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ ...mono, fontSize: 9, color: C.ocean, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>what's in the way</div>
                      <div style={{ fontSize: 15, color: C.text, lineHeight: 1.75, fontStyle: "italic" }}>"{selected.fears_reflection}"</div>
                    </div>
                  )}

                  <div style={{ height: 1, background: C.border, marginBottom: 20 }} />

                  {deleteTarget === selected.id ? (
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ ...mono, fontSize: 11, color: "#e07868" }}>delete this entry?</span>
                      <button
                        onClick={() => handleDelete(selected.id)}
                        disabled={deleting}
                        style={{ background: "#e0786818", border: "1px solid #e07868", borderRadius: 8, padding: "6px 14px", color: "#e07868", fontSize: 11, cursor: "pointer", ...mono }}
                      >{deleting ? "deleting…" : "confirm delete"}</button>
                      <button onClick={() => setDeleteTarget(null)} style={{ background: "none", border: "none", color: C.muted, fontSize: 11, cursor: "pointer", ...mono }}>cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteTarget(selected.id)}
                      style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 16px", color: C.muted, fontSize: 11, cursor: "pointer", ...mono, transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#e07868"; e.currentTarget.style.borderColor = "#e07868"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = C.border; }}
                    >delete entry</button>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Delete confirm (triggered from list ✕ button) ── */}
      {deleteTarget && !selected && (
        <div
          onClick={() => setDeleteTarget(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 16, padding: "28px 32px", maxWidth: 320, width: "90%" }}
          >
            <div style={{ fontSize: 15, color: C.pearl, marginBottom: 6 }}>Delete this entry?</div>
            <div style={{ ...mono, fontSize: 11, color: C.muted, marginBottom: 24 }}>this cannot be undone</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => handleDelete(deleteTarget)}
                disabled={deleting}
                style={{ flex: 1, background: "#e0786818", border: "1px solid #e07868", borderRadius: 10, padding: "10px", color: "#e07868", fontSize: 12, cursor: "pointer", ...mono }}
              >{deleting ? "deleting…" : "delete"}</button>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px", color: C.muted, fontSize: 12, cursor: "pointer", ...mono }}
              >cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfilesView({ profiles, C, mono, QUADRANT_READS }) {
  const withLinkedin = profiles.filter(p => p.linkedin);
  const withEmail    = profiles.filter(p => p.email);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 120px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ ...mono, fontSize: 9, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>total profiles</div>
          <div style={{ fontSize: 28, color: C.pearl, fontFamily: "Georgia, serif" }}>{profiles.length}</div>
        </div>
        <div style={{ flex: "1 1 120px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ ...mono, fontSize: 9, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>with linkedin</div>
          <div style={{ fontSize: 28, color: C.ocean, fontFamily: "Georgia, serif" }}>{withLinkedin.length}</div>
        </div>
        <div style={{ flex: "1 1 120px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ ...mono, fontSize: 9, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>with email</div>
          <div style={{ fontSize: 28, color: C.seafoam, fontFamily: "Georgia, serif" }}>{withEmail.length}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {profiles.map(p => {
          const key = Object.keys(QUADRANT_READS).find(k => QUADRANT_READS[k].title === p.quadrant);
          const color = key ? QUADRANT_READS[key].color : C.muted;
          const date = p.created_at
            ? new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : "";
          const liUrl = p.linkedin
            ? (p.linkedin.startsWith("http") ? p.linkedin : `https://${p.linkedin}`)
            : null;
          return (
            <div
              key={p.id}
              style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderLeft: `3px solid ${color}`, borderRadius: 10, padding: "14px 16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, color: C.pearl, fontWeight: 500 }}>{p.name || "Anonymous"}</span>
                  {p.quadrant && <span style={{ ...mono, fontSize: 10, color, letterSpacing: 0.5 }}>{p.quadrant}</span>}
                </div>
                <span style={{ ...mono, fontSize: 10, color: C.dim }}>{date}</span>
              </div>
              {p.email && (
                <div style={{ ...mono, fontSize: 11, color: C.muted, marginBottom: 4 }}>{p.email}</div>
              )}
              {liUrl && (
                <a
                  href={liUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...mono, fontSize: 11, color: C.ocean, textDecoration: "none", display: "block" }}
                >
                  {p.linkedin.replace(/^https?:\/\/(www\.)?/, "")} →
                </a>
              )}
              {!p.email && !p.linkedin && (
                <div style={{ ...mono, fontSize: 10, color: C.dim, fontStyle: "italic" }}>no contact info</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
