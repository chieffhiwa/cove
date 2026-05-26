import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { upsertProfile } from "./lib/api";
import { LIGHT, DARK } from "./config/palette";
import { FEELINGS } from "./config/feelings";
import { TAGLINE, DEFAULT_USER_DATA, HOME_QUOTES } from "./config/constants";
import { QUADRANT_READS, getQuadrant } from "./config/quadrants";
import { ThemeContext } from "./context/ThemeContext";
import { useFadeIn, fadeStyle } from "./lib/hooks";
import { Onboard } from "./screens/Onboard";
import { LoginLanding } from "./screens/LoginLanding";
import { CoachDashboard } from "./screens/CoachDashboard";
import { Shell } from "./components/Shell";
import { Avatar } from "./components/Avatar";
import { Btn } from "./components/Btn";

let C = LIGHT;

export default function App() {
  const isCoach = typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("coach") === "true";
  if (isCoach) return <CoachDashboard />;
  return <AppInner />;
}

function AppInner() {
  const [phase, setPhase] = useState("login");
  const [onboardStep, setStep] = useState(0);
  const [userData, setUserData] = useState(DEFAULT_USER_DATA);
  const [mainTab, setMainTab]   = useState("home");
  const [activeContact, setActiveContact] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("cove_dark") === "true");
  const [supaUser, setSupaUser] = useState(null);
  const [showFeaturePopup, setShowFeaturePopup] = useState(false);

  const themeValue = darkMode ? DARK : LIGHT;
  C = themeValue; // keep module-level C in sync during transition

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("cove_dark", String(next));
  };

  const update = (patch) => setUserData(d => ({ ...d, ...patch }));

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) localStorage.setItem("cove_ref", ref);
  }, []);

  // Supabase auth listener
  useEffect(() => {
    const loadProfile = async (user) => {
      if (!user?.email) return;
      const { data } = await supabase.from("profiles").select("*").eq("email", user.email).maybeSingle();

      if (!data) {
        // No profile row yet — seed one linked to this auth email and store the ID
        const { data: newRow } = await supabase
          .from("profiles")
          .insert({ email: user.email, updated_at: new Date().toISOString() })
          .select("id").maybeSingle();
        if (newRow?.id) localStorage.setItem("cove_profile_id", newRow.id);
        setUserData(prev => ({ ...prev, email: user.email }));
        return;
      }

      // Profile exists — store its ID so future saves go to the right row
      if (data.id) localStorage.setItem("cove_profile_id", data.id);

      // Restore list from Supabase if localStorage is empty
      if (data.list_data?.length && !localStorage.getItem("cove_list100")) {
        localStorage.setItem("cove_list100", JSON.stringify(data.list_data));
      }

      const restored = {
        name: data.name || "",
        email: data.email || user.email,
        phone: data.phone || "",
        linkedin: data.linkedin || "",
        photoUrl: data.photo_url || "",
        selfPosition: (data.x != null && data.y != null) ? { x: data.x, y: data.y } : null,
        braveReflection: data.brave_reflection || "",
        fearsReflection: data.fears_reflection || "",
        wants: data.wants || [],
        contacts: data.contacts || [],
      };
      setUserData(prev => {
        const merged = { ...restored };
        if (prev.name) merged.name = prev.name;
        if (prev.selfPosition) merged.selfPosition = prev.selfPosition;
        if (prev.contacts?.length) merged.contacts = prev.contacts;
        if (prev.braveReflection) merged.braveReflection = prev.braveReflection;
        if (prev.fearsReflection) merged.fearsReflection = prev.fearsReflection;
        if (prev.wants?.length) merged.wants = prev.wants;
        if (prev.email) merged.email = prev.email;
        if (prev.phone) merged.phone = prev.phone;
        if (prev.linkedin) merged.linkedin = prev.linkedin;
        if (prev.photoUrl) merged.photoUrl = prev.photoUrl;
        return merged;
      });
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      setSupaUser(user);
      if (user) { loadProfile(user); setPhase(prev => prev === "login" ? "main" : prev); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const user = session?.user ?? null;
      setSupaUser(user);
      if (user) { loadProfile(user); setPhase(prev => prev === "login" ? "main" : prev); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Show feature popup once when entering main phase
  useEffect(() => {
    if (phase === "main" && !localStorage.getItem("cove_feature_popup_v1")) {
      setTimeout(() => setShowFeaturePopup(true), 800);
    }
  }, [phase]);

  if (phase === "login") {
    return (
      <ThemeContext.Provider value={themeValue}>
        <LoginLanding
          onLogin={() => setPhase("main")}
          onNewUser={() => { setStep(0); setUserData(DEFAULT_USER_DATA); setPhase("onboard"); }}
          darkMode={darkMode}
          toggleDark={toggleDark}
        />
      </ThemeContext.Provider>
    );
  }

  if (phase === "onboard") {
    return (
      <ThemeContext.Provider value={themeValue}>
        <Onboard
          step={onboardStep}
          setStep={setStep}
          userData={userData}
          update={update}
          supaUser={supaUser}
          finish={() => { upsertProfile(userData); setPhase("main"); }}
          onGoToLogin={() => setPhase("login")}
          darkMode={darkMode}
          toggleDark={toggleDark}
        />
      </ThemeContext.Provider>
    );
  }

  const resetAll = () => {
    setPhase("onboard");
    setStep(0);
    setUserData(DEFAULT_USER_DATA);
    setMainTab("home");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserData(DEFAULT_USER_DATA);
    setStep(0);
    setPhase("login");
  };

  return (
    <ThemeContext.Provider value={themeValue}>
      <>
        <MainApp
          userData={userData}
          update={update}
          tab={mainTab}
          setTab={setMainTab}
          activeContact={activeContact}
          setActiveContact={setActiveContact}
          onReset={resetAll}
          onSignOut={signOut}
          onGoToLogin={() => setPhase("login")}
          darkMode={darkMode}
          toggleDark={toggleDark}
          supaUser={supaUser}
        />
        {showFeaturePopup && (
          <FeaturePopup
            onDismiss={() => {
              localStorage.setItem("cove_feature_popup_v1", "seen");
              setShowFeaturePopup(false);
            }}
            onTryCoach={() => {
              localStorage.setItem("cove_feature_popup_v1", "seen");
              setShowFeaturePopup(false);
              setMainTab("coach");
            }}
          />
        )}
      </>
    </ThemeContext.Provider>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════

function MainApp({ userData, update, tab, setTab, activeContact, setActiveContact, onReset, onSignOut, onGoToLogin, darkMode, toggleDark, supaUser }) {
  const openContact = (c) => { setActiveContact(c); setTab("contact"); };
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(userData.name || "");

  const saveName = () => {
    const name = nameInput.trim();
    if (name) { update({ name }); upsertProfile({ ...userData, name }); }
    setEditingName(false);
  };

  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 22px", borderBottom: `1px solid ${C.borderSoft}`,
          flexShrink: 0, background: C.bg, zIndex: 20,
        }}>
          {tab === "contact" && activeContact
            ? <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div onClick={() => setTab("home")} style={{ fontSize: 18, color: C.muted, cursor: "pointer", padding: "4px 8px 4px 0" }}>‹</div>
                <div>
                  <div style={{ fontSize: 14, color: C.pearl, fontWeight: 500 }}>{activeContact.first} {activeContact.last}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{activeContact.company}</div>
                </div>
              </div>
            : <div style={{ fontSize: 16, letterSpacing: 4, color: C.ocean, fontFamily: "monospace" }}>cove</div>
          }
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={toggleDark}
              title={darkMode ? "switch to light" : "switch to dark"}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, padding: "2px 4px", color: C.dim, lineHeight: 1 }}
            >{darkMode ? "☀︎" : "☽"}</button>
            <div style={{ fontSize: 12, color: C.dim }}>
              {tab !== "contact" && (
                editingName
                  ? <input
                      autoFocus
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      onBlur={saveName}
                      onKeyDown={e => e.key === "Enter" && saveName()}
                      style={{
                        background: "transparent", border: "none",
                        borderBottom: `1px solid ${C.ocean}`,
                        color: C.pearl, fontSize: 12, outline: "none",
                        width: 80, fontFamily: "Georgia, serif",
                      }}
                    />
                  : <span
                      onClick={() => { setNameInput(userData.name || ""); setEditingName(true); }}
                      style={{ cursor: "pointer", borderBottom: `1px dashed ${C.dim}` }}
                      title="tap to edit"
                    >
                      hi, {userData.name || "you"}
                    </span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, height: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 16 }}>
          {tab === "home"      && <HomeTab      userData={userData} openContact={openContact} setTab={setTab} />}
          {tab === "contact"   && activeContact && <ContactTab contact={activeContact} />}
          {tab === "values"    && <ValuesTab    wants={userData.wants} />}
          {tab === "matrix"    && <MatrixTab    contacts={userData.contacts} openContact={openContact} selfPosition={userData.selfPosition} name={userData.name} />}
          {tab === "coach"     && <CoachTab     supaUser={supaUser} userData={userData} />}
          {tab === "matches"   && <MatchesTab   supaUser={supaUser} userData={userData} />}
          {tab === "list"      && <List100Tab userData={userData} onListSave={(list) => upsertProfile({ ...userData, listData: list })} />}
          {tab === "you"       && <ProfileTab   userData={userData} update={update} onReset={onReset} onSignOut={onSignOut} onGoToLogin={onGoToLogin} supaUser={supaUser} />}
        </div>

        {/* Bottom nav */}
        <div style={{
          display: "flex", justifyContent: "space-around",
          padding: "12px 8px 24px",
          borderTop: `1px solid ${C.borderSoft}`,
          background: C.bg,
          flexShrink: 0, zIndex: 20,
        }}>
          {[
            { id: "home",    label: "Home",    icon: "⌂" },
            { id: "coach",   label: "Coach",   icon: "💬", isNew: true },
            { id: "matches", label: "Matches", icon: "◎", isNew: true },
            { id: "list",    label: "List",    icon: "≡" },
            { id: "you",     label: "You",     icon: "◉" },
          ].map(t => (
            <div
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                padding: "6px 12px", borderRadius: 10, cursor: "pointer",
                color: tab === t.id ? C.ocean : C.muted,
                transition: "color 0.15s, transform 0.1s", position: "relative",
                touchAction: "manipulation", WebkitTapHighlightColor: "transparent",
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span>
              <span style={{ fontSize: 9, letterSpacing: 0.5, fontFamily: "monospace" }}>{t.label.toUpperCase()}</span>
              {t.isNew && tab !== t.id && (
                <span style={{
                  position: "absolute", top: 2, right: 8,
                  background: C.seafoam, color: C.bg,
                  fontSize: 7, fontWeight: 700, fontFamily: "monospace",
                  padding: "1px 4px", borderRadius: 4, letterSpacing: 0.5,
                }}>NEW</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

// ── Home Tab ──────────────────────────────────────────────────────────────────

function HomeTab({ userData, setTab }) {
  const visible = useFadeIn(["home"]);
  const firstName = userData.name?.split(" ")[0] || null;
  const quadrant = userData.selfPosition ? getQuadrant(userData.selfPosition.x, userData.selfPosition.y) : null;
  const qr = quadrant ? QUADRANT_READS[quadrant] : null;

  // Load contacts from list100 or fall back to onboarding contacts
  const listEntries = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem("cove_list100") || "[]");
      if (saved.length > 0) return saved;
    } catch {}
    return (userData.contacts || []).map(c => {
      const parts = (c.name || "").trim().split(" ");
      return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") || "", warm: "warm", attempt1: "", attempt2: "" };
    });
  })();

  // Rotate quote by day
  const quote = HOME_QUOTES[Math.floor(Date.now() / 86400000) % HOME_QUOTES.length];

  return (
    <div style={{ ...fadeStyle(visible), padding: "28px 22px" }}>

      {/* Hero card — greeting + matrix position */}
      <div style={{
        position: "relative", overflow: "hidden",
        borderRadius: 16, marginBottom: 24,
        background: C.surface,
        border: `1px solid ${C.borderSoft}`,
        padding: "24px 22px",
        minHeight: 130,
      }}>
        {/* Background matrix — right side */}
        {qr && userData.selfPosition && (
          <div style={{
            position: "absolute", right: 18, top: "50%",
            transform: "translateY(-50%)",
            width: 112, height: 112,
          }}>
            <div style={{ position: "absolute", inset: 0, border: `1px solid ${C.ocean}22`, borderRadius: 8 }} />
            <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: `${C.ocean}18` }} />
            <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: `${C.ocean}18` }} />
            {/* Active quadrant fill */}
            <div style={{
              position: "absolute",
              left: userData.selfPosition.x >= 50 ? "50%" : 0,
              top: userData.selfPosition.y <= 50 ? 0 : "50%",
              width: "50%", height: "50%",
              background: `${qr.color}16`,
              borderRadius: userData.selfPosition.x >= 50
                ? (userData.selfPosition.y <= 50 ? "0 8px 0 0" : "0 0 8px 0")
                : (userData.selfPosition.y <= 50 ? "8px 0 0 0" : "0 0 0 8px"),
            }} />
            {/* Pulsing dot */}
            <div style={{
              position: "absolute",
              left: `${userData.selfPosition.x}%`,
              top: `${userData.selfPosition.y}%`,
              transform: "translate(-50%, -50%)",
            }}>
              <div style={{
                width: 11, height: 11, borderRadius: "50%",
                background: qr.color,
                boxShadow: `0 0 10px ${qr.color}`,
                animation: "cove-pulse 2.5s ease-in-out infinite",
              }} />
            </div>
          </div>
        )}

        {/* Text */}
        <div style={{ maxWidth: qr ? "56%" : "100%", position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: C.ocean, fontFamily: "monospace", marginBottom: 14, opacity: 0.65 }}>
            C O V E
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 400, margin: "0 0 8px", color: C.pearl, letterSpacing: -0.5, lineHeight: 1.25 }}>
            {firstName ? `Hey, ${firstName}.` : "Welcome back."}
          </h1>
          <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.75, margin: qr ? "0 0 14px" : 0 }}>
            {TAGLINE}
          </p>
          {qr && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: qr.color, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: qr.color, fontFamily: "monospace", letterSpacing: 1.5 }}>
                {qr.title.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Running contact list */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1.5, fontFamily: "monospace", textTransform: "uppercase" }}>your people</div>
          <span
            onClick={() => setTab("list")}
            style={{ fontSize: 11, color: C.ocean, fontFamily: "monospace", cursor: "pointer" }}
          >
            see all →
          </span>
        </div>

        {listEntries.length === 0 ? (
          <div
            onClick={() => setTab("list")}
            style={{
              padding: "20px", borderRadius: 12, textAlign: "center",
              background: C.surface, border: `1px dashed ${C.border}`,
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>Your list is empty</div>
            <span style={{ fontSize: 12, color: C.ocean, fontFamily: "monospace" }}>+ add your first contact →</span>
          </div>
        ) : (
          <div style={{
            background: C.surface, borderRadius: 12,
            border: `1px solid ${C.borderSoft}`, overflow: "hidden",
          }}>
            {listEntries.slice(0, 5).map((e, i) => {
              const fullName = `${e.firstName || ""} ${e.lastName || ""}`.trim() || e.name || "—";
              const a1Color = { sent: C.ocean, replied: "#6dbb8a", call: "#c4a040" }[e.attempt1] || C.dim;
              return (
                <div
                  key={i}
                  onClick={() => setTab("list")}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "11px 14px",
                    borderBottom: i < Math.min(listEntries.length, 5) - 1 ? `1px solid ${C.borderSoft}` : "none",
                    cursor: "pointer",
                  }}
                >
                  <Avatar name={fullName} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: C.text, marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fullName}</div>
                    {e.company && <div style={{ fontSize: 11, color: C.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.company}</div>}
                  </div>
                  {e.attempt1 && e.attempt1 !== "—" ? (
                    <span style={{
                      fontSize: 9, fontFamily: "monospace", padding: "2px 7px", borderRadius: 20, flexShrink: 0,
                      background: `${a1Color}15`, color: a1Color, border: `1px solid ${a1Color}40`,
                    }}>{e.attempt1}</span>
                  ) : (
                    <span style={{
                      fontSize: 9, fontFamily: "monospace", padding: "2px 7px", borderRadius: 20, flexShrink: 0,
                      background: e.warm === "warm" ? "#c4702012" : `${C.ocean}10`,
                      color: e.warm === "warm" ? "#c47020" : C.muted,
                      border: `1px solid ${e.warm === "warm" ? "#c4702030" : C.border}`,
                    }}>{e.warm === "warm" ? "warm" : "cold"}</span>
                  )}
                </div>
              );
            })}
            {listEntries.length > 5 && (
              <div
                onClick={() => setTab("list")}
                style={{
                  padding: "10px 14px", fontSize: 11, color: C.ocean,
                  fontFamily: "monospace", textAlign: "center",
                  borderTop: `1px solid ${C.borderSoft}`, cursor: "pointer",
                }}
              >
                +{listEntries.length - 5} more → open list
              </div>
            )}
          </div>
        )}
      </div>

      {/* Matrix deep read */}
      {qr && (
        <div style={{ marginBottom: 28 }}>
          <SectionLabel>the read on you</SectionLabel>
          <div style={{
            padding: "18px 20px", borderRadius: 12,
            background: C.surface, border: `1px solid ${C.borderSoft}`,
            borderLeft: `3px solid ${qr.color}40`,
          }}>
            <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.85 }}>{qr.read}</p>
          </div>
        </div>
      )}

      {/* Daily quote */}
      <blockquote style={{
        margin: 0, padding: "18px 20px", borderRadius: 12,
        background: C.surface, border: `1px solid ${C.borderSoft}`,
        borderLeft: `2px solid ${C.oceanDeep}`,
      }}>
        <p style={{ margin: "0 0 6px", fontSize: 13, color: C.muted, fontStyle: "italic", lineHeight: 1.9 }}>
          "{quote.text}"
        </p>
        {quote.attr && (
          <p style={{ margin: 0, fontSize: 11, color: C.dim, fontFamily: "monospace" }}>{quote.attr}</p>
        )}
      </blockquote>

    </div>
  );
}

// ── Contact Tab ───────────────────────────────────────────────────────────────
function ContactTab({ contact: c }) {
  const visible = useFadeIn([c.first]);
  const [openInsight, setOpenInsight] = useState(null);

  const defaultInsights = [
    { label: "Why they matter",  body: c.note || "You added them for a reason. That instinct is data. Trust it." },
    { label: "How to show up",   body: "Don't be generic. Generic gets ignored. Reference something specific: a talk, a decision they made publicly, something you actually read. That's what separates the outreach that lands from the outreach that sits in their 'maybe later' folder forever." },
    { label: "The give",         body: "Before you ask for anything, ask yourself: what can I bring to this? An intro, a perspective, a resource they'd actually want. Come with something. People remember the ones who show up with gifts." },
  ];

  const insights = (c.insights || defaultInsights);
  // eslint-disable-next-line no-unused-vars
  const done = (c.attempts || []).filter(a => a.status !== "pending").length;

  return (
    <div style={{ ...fadeStyle(visible), padding: "24px 22px" }}>

      {/* Person header */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 28 }}>
        <Avatar name={c.first} size={60} glow />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 400, margin: "0 0 4px", color: C.pearl }}>
            {c.first} {c.last}
          </h1>
          <div style={{ fontSize: 13, color: C.muted }}>{c.role && `${c.role} · `}{c.company}</div>
        </div>
      </div>

      {/* Attempts */}
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        {[0,1,2].map(i => {
          const a = (c.attempts || [])[i] || {};
          return (
            <div key={i} style={{
              flex: 1, padding: "12px 10px", borderRadius: 10, textAlign: "center",
              background: a.status === "replied" ? C.seafoam+"15"
                        : a.status === "sent"    ? C.ocean+"12"
                        : C.surface,
              border: `1px solid ${a.status === "replied" ? C.seafoam+"50"
                                 : a.status === "sent"    ? C.ocean+"40"
                                 : C.borderSoft}`,
            }}>
              <div style={{
                fontSize: 12, fontWeight: 600, marginBottom: 3,
                color: a.status === "replied" ? C.seafoam
                     : a.status === "sent"    ? C.ocean
                     : C.dim,
              }}>
                {a.status === "replied" ? "✓" : a.status === "sent" ? i + 1 : i + 1}
              </div>
              <div style={{ fontSize: 9, color: C.muted, fontFamily: "monospace" }}>
                {a.status === "pending" ? "pending" : a.channel || "sent"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Note */}
      {c.note && (
        <div style={{
          padding: "16px 18px", borderRadius: 10, marginBottom: 24,
          background: C.surface, border: `1px solid ${C.borderSoft}`,
          borderLeft: `2px solid ${C.oceanDeep}`,
        }}>
          <SectionLabel>your note</SectionLabel>
          <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.9, fontStyle: "italic" }}>"{c.note}"</p>
        </div>
      )}

      {/* Go deeper */}
      <SectionLabel>go deeper</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 28 }}>
        {insights.map((ins, i) => (
          <div key={i}>
            <div
              onClick={() => setOpenInsight(openInsight === i ? null : i)}
              style={{
                padding: "15px 18px",
                borderRadius: openInsight === i ? "10px 10px 0 0" : 10,
                background: openInsight === i ? C.raised : C.surface,
                border: `1px solid ${openInsight === i ? C.tide : C.borderSoft}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 13, color: openInsight === i ? C.sky : C.text }}>{ins.label}</span>
              <span style={{
                color: C.muted, fontSize: 16,
                transform: openInsight === i ? "rotate(90deg)" : "none",
                transition: "transform 0.2s", display: "inline-block",
              }}>›</span>
            </div>
            {openInsight === i && (
              <div style={{
                padding: "16px 18px", background: C.raised,
                border: `1px solid ${C.tide}`, borderTop: "none",
                borderRadius: "0 0 10px 10px",
              }}>
                <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.9 }}>{ins.body}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Feeling */}
      {c.feeling && (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: C.dim }}>feeling underneath:</span>
          <span style={{
            fontSize: 12, padding: "4px 12px", borderRadius: 20,
            background: C.ocean+"18", color: C.sky,
            border: `1px solid ${C.ocean}40`,
          }}>{c.feeling}</span>
        </div>
      )}
    </div>
  );
}

// ── Values Tab ────────────────────────────────────────────────────────────────
function ValuesTab({ wants = [] }) {
  const visible = useFadeIn(["values"]);
  const [open, setOpen] = useState(null);
  const grouped = {};
  wants.forEach(w => {
    if (!w.feeling) return;
    if (!grouped[w.feeling]) grouped[w.feeling] = [];
    grouped[w.feeling].push(w);
  });

  const reflections = {
    Freedom:   "Freedom keeps coming up because you've felt what it's like when it's gone. You're not trying to escape. You're trying to work like a whole person. Don't negotiate this one away cheaply.",
    Legacy:    "You want to matter beyond the role. That's integrity. The work that earns Legacy is work where you can say 'I built that' and mean it in a way that runs deeper than your title.",
    Curiosity: "You need a problem worth losing yourself in. If you can't see yourself still curious about the work in year two, that's a signal. It never gets more interesting only more familiar.",
    Stability: "This isn't playing it safe. It's building a floor solid enough that you can take the risks that actually count. Know your number. Don't go below it.",
    Joy:       "You've tried the joyless version. It doesn't work. Joy is the difference between your best self showing up and a functional version of you showing up. Hold that line.",
    Access:    "You've earned the right to want a real seat — actual influence. The rooms where decisions happen are the rooms you belong in. Hold out for that.",
  };

  if (wants.length === 0) {
    return (
      <div style={{ padding: "28px 22px", color: C.muted, fontSize: 14 }}>
        Complete onboarding to see your values here.
      </div>
    );
  }

  return (
    <div style={{ ...fadeStyle(visible), padding: "28px 22px" }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 400, margin: "0 0 8px", color: C.pearl }}>Values</h2>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: 0 }}>
          The feeling underneath the want is the real requirement. Everything else is negotiable.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {Object.entries(grouped).map(([feeling, vs]) => {
          const f = FEELINGS.find(fl => fl.id === feeling);
          return (
            <div key={feeling}>
              <div
                onClick={() => setOpen(open === feeling ? null : feeling)}
                style={{
                  padding: "16px 18px",
                  borderRadius: open === feeling ? "10px 10px 0 0" : 10,
                  background: open === feeling ? C.raised : C.surface,
                  border: `1px solid ${open === feeling ? C.tide : C.borderSoft}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: f?.color || C.ocean, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: open === feeling ? C.sky : C.text }}>{feeling}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{vs.length}</span>
                </div>
                <span style={{
                  color: C.muted, fontSize: 16,
                  transform: open === feeling ? "rotate(90deg)" : "none",
                  transition: "transform 0.2s", display: "inline-block",
                }}>›</span>
              </div>
              {open === feeling && (
                <div style={{
                  background: C.raised, border: `1px solid ${C.tide}`,
                  borderTop: "none", borderRadius: "0 0 10px 10px",
                }}>
                  {vs.map((v, i) => (
                    <div key={i} style={{
                      padding: "12px 18px",
                      borderTop: i > 0 ? `1px solid ${C.borderSoft}` : "none",
                    }}>
                      <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>: {v.text}</span>
                    </div>
                  ))}
                  {reflections[feeling] && (
                    <div style={{ padding: "14px 18px", borderTop: `1px solid ${C.borderSoft}`, background: C.surface }}>
                      <p style={{ margin: 0, fontSize: 12, color: C.ocean, fontStyle: "italic", lineHeight: 1.9 }}>
                        {reflections[feeling]}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Matrix Tab ────────────────────────────────────────────────────────────────
function MatrixTab({ contacts = [], openContact, selfPosition, name }) {
  const visible = useFadeIn(["matrix"]);
  // eslint-disable-next-line no-unused-vars
  const [hovered, setHovered] = useState(null);
  const gridRef = useRef(null);

  const selfQuadrant = selfPosition ? QUADRANT_READS[getQuadrant(selfPosition.x, selfPosition.y)] : null;

  return (
    <div style={{ ...fadeStyle(visible), padding: "28px 22px" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 400, margin: "0 0 8px", color: C.pearl }}>Matrix</h2>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: 0 }}>
          You on the grid. Your people on the grid. Now you see the whole picture.
        </p>
      </div>

      {/* Empty state */}
      {!selfPosition && (
        <div style={{
          padding: "28px 24px", borderRadius: 14, marginBottom: 20,
          background: C.surface, border: `1px dashed ${C.border}`,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⊹</div>
          <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.8, margin: 0 }}>
            Your placement will appear here after you complete the matrix step.
          </p>
        </div>
      )}

      {/* Self read card */}
      {selfQuadrant && (
        <div style={{
          marginBottom: 16, padding: "14px 16px", borderRadius: 10,
          background: C.raised, border: `1px solid ${selfQuadrant.color}40`,
          borderLeft: `3px solid ${selfQuadrant.color}`,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <Avatar name={name || "Y"} size={34} glow />
          <div>
            <div style={{ fontSize: 10, color: selfQuadrant.color, fontFamily: "monospace", letterSpacing: 1, marginBottom: 3 }}>YOU {selfQuadrant.title.toUpperCase()}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{selfQuadrant.short}</div>
          </div>
        </div>
      )}

      <div
        ref={gridRef}
        style={{
          position: "relative", background: C.surface,
          border: `1px solid ${C.border}`, borderRadius: 14,
          aspectRatio: "1/1", width: "100%", overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: C.border }} />
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: C.border }} />
        {[
          { text: "BRAVE",      style: { top: 10, left: "50%", transform: "translateX(-50%)", color: C.seafoam } },
          { text: "FEARFUL",    style: { bottom: 10, left: "50%", transform: "translateX(-50%)", color: C.muted } },
          { text: "CURIOUS",    style: { right: 8, top: "50%", transform: "translateY(-50%)", color: C.ocean } },
          { text: "JUDGMENTAL", style: { left: 6, top: "50%", transform: "translateY(-50%) rotate(180deg)", color: C.muted, writingMode: "vertical-rl" } },
        ].map((l, i) => (
          <div key={i} style={{ position: "absolute", fontSize: 7, fontFamily: "monospace", letterSpacing: 2, fontWeight: 700, ...l.style }}>{l.text}</div>
        ))}
        <div style={{ position: "absolute", top: 24, right: 20, fontSize: 8, color: C.seafoam+"45", fontFamily: "monospace" }}>fast movers</div>
        <div style={{ position: "absolute", bottom: 24, right: 20, fontSize: 8, color: C.ocean+"40", fontFamily: "monospace" }}>deep thinkers</div>
        <div style={{ position: "absolute", top: 24, left: 20, fontSize: 8, color: C.muted+"40", fontFamily: "monospace" }}>hold the line</div>

        {/* Self dot glowing ring to distinguish from contacts */}
        {selfPosition && (
          <div style={{
            position: "absolute",
            left: `${selfPosition.x}%`, top: `${selfPosition.y}%`,
            transform: "translate(-50%,-50%)",
            zIndex: 5,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: "50%",
              background: `linear-gradient(150deg, ${C.oceanDeep}, ${selfQuadrant?.color || C.tide})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 700, color: C.pearl,
              boxShadow: `0 0 0 4px ${C.bg}, 0 0 0 6px ${selfQuadrant?.color || C.ocean}60`,
              border: `2px solid ${C.sky}`,
            }}>{name ? name[0].toUpperCase() : "Y"}</div>
            <div style={{
              position: "absolute", top: "110%", left: "50%", transform: "translateX(-50%)",
              fontSize: 8, color: C.muted, whiteSpace: "nowrap", marginTop: 3,
              fontFamily: "monospace",
            }}>you</div>
          </div>
        )}

        {/* Contact dots */}
        {contacts.map((c, i) => {
          const displayName = c.first ? `${c.first} ${c.last || ""}`.trim() : (c.name || "?");
          const initials = displayName[0]?.toUpperCase() || "?";
          const dotX = c.quadrant?.x || (50 + ((i * 17 + 13) % 40) - 20);
          const dotY = c.quadrant?.y || (50 + ((i * 23 + 7) % 40) - 20);
          return (
            <div
              key={i}
              onClick={() => openContact(c)}
              onTouchStart={() => setHovered(displayName)}
              onTouchEnd={() => setHovered(null)}
              style={{
                position: "absolute",
                left: `${dotX}%`,
                top: `${dotY}%`,
                transform: "translate(-50%,-50%)",
                cursor: "pointer", zIndex: 10,
              }}
            >
              <Avatar name={initials} size={36} />
              <div style={{
                position: "absolute", top: "110%", left: "50%", transform: "translateX(-50%)",
                fontSize: 8, color: C.muted, whiteSpace: "nowrap", marginTop: 3,
                fontFamily: "monospace",
              }}>{displayName.split(" ")[0]}</div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 20, padding: "16px 18px", borderRadius: 10,
        background: C.surface, border: `1px solid ${C.borderSoft}`,
        borderLeft: `2px solid ${C.oceanDeep}`,
      }}>
        <SectionLabel>real talk</SectionLabel>
        <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.9 }}>
          Not everyone gets the front row. Your energy is finite and the people in the top-right quadrant will multiply it. The others still deserve your generosity just in different doses. This is how you stay warm without burning out.
        </p>
      </div>
    </div>
  );
}

// ── Feature Popup ─────────────────────────────────────────────────────────────
function FeaturePopup({ onDismiss, onTryCoach }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const features = [
    { icon: "💬", title: "AI Coach",       desc: "Talk through your career — get real, personalized coaching." },
    { icon: "🧠", title: "Q&A Engine",     desc: "Answer layered questions. Your profile gets smarter with every answer." },
    { icon: "◎",  title: "Matches",        desc: "See who has a similar matrix — and what you share." },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      opacity: visible ? 1 : 0,
      transition: "opacity 0.3s ease",
    }}>
      <div style={{
        width: "100%", maxWidth: 480,
        background: C.surface,
        borderRadius: "24px 24px 0 0",
        padding: "28px 24px 40px",
        transform: visible ? "translateY(0)" : "translateY(40px)",
        transition: "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
      }}>
        {/* Drag handle */}
        <div style={{ width: 40, height: 4, background: C.border, borderRadius: 2, margin: "0 auto 24px" }} />

        <div style={{ fontSize: 10, letterSpacing: 3, color: C.ocean, fontFamily: "monospace", marginBottom: 8 }}>✦ JUST SHIPPED</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: C.pearl, margin: "0 0 6px", lineHeight: 1.25 }}>
          Coach & Matches are live.
        </h2>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, margin: "0 0 22px" }}>
          We built the things that make Cove actually useful. Here's what's new:
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {features.map((f, i) => (
            <div key={i} style={{
              display: "flex", gap: 14, padding: "14px 16px",
              borderRadius: 12, background: C.bg,
              border: `1px solid ${C.borderSoft}`,
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{f.icon}</span>
              <div>
                <div style={{ fontSize: 14, color: C.pearl, fontWeight: 600, marginBottom: 3 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div onClick={onTryCoach} style={{
          background: C.ocean, color: "#fff", textAlign: "center",
          padding: "16px 0", borderRadius: 12, cursor: "pointer",
          fontSize: 16, fontWeight: 600, marginBottom: 12,
          boxShadow: `0 4px 16px rgba(30,111,168,0.3)`,
          touchAction: "manipulation",
        }}>
          try coach now →
        </div>
        <div onClick={onDismiss} style={{
          textAlign: "center", padding: "10px 0",
          fontSize: 13, color: C.dim, cursor: "pointer",
        }}>
          maybe later
        </div>
      </div>
    </div>
  );
}

// ── Coach Tab ─────────────────────────────────────────────────────────────────
const ANTHROPIC_KEY = process.env.REACT_APP_ANTHROPIC_KEY;

const ARCHETYPE_DESCRIPTIONS = {
  Pioneer: "acts fast, asks big questions, bridges between worlds, but can lose the thread",
  Builder: "executes with conviction, needs someone to ask why, doesn't wait for permission",
  Sage:    "sees patterns others miss, thinks before leaping, needs someone to push them out the door",
  Anchor:  "deep expertise, high reliability, steady — needs someone to expand their horizon",
};

function buildCoachPrompt(archetype, bravery, curiosity) {
  const base = `You are a calm, honest career coach inside Cove — an app for early-career people navigating jobs, networks, and what they actually want. Your tone: warm but direct. No corporate speak. No empty affirmations. You say hard things gently. You ask one good question at a time. Keep responses short — 2-4 sentences unless the person is sharing something long.`;
  if (!archetype) return base;
  const score = `bravery ${Math.round((bravery ?? 0.5) * 100)}, curiosity ${Math.round((curiosity ?? 0.5) * 100)}`;
  return `${base}\n\nThe person you're talking to has a ${archetype} profile (${score}): ${ARCHETYPE_DESCRIPTIONS[archetype] ?? "still figuring out their shape"}. Speak to that. Don't mention the matrix directly — let it shape how you respond.`;
}

const COACH_SEED_PROMPTS = [
  "I keep applying but never hearing back.",
  "I don't know what I actually want.",
  "I have an offer but I'm not sure about it.",
  "How do I reach out to someone I don't know?",
];

const LAYER_LABELS = { 1: "GETTING TO KNOW YOU", 2: "GOING DEEPER", 3: "EARNED THIS ONE" };
const LAYER_COLORS = { 1: "#1e6fa8", 2: "#178a72", 3: "#6d3fa8" };

function CoachTab({ supaUser, userData }) {
  const [messages, setMessages] = useState([{ role: "assistant", content: "Hey. What's actually going on right now?" }]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [question, setQuestion] = useState(null);
  const [qVisible, setQVisible] = useState(false);
  const [matrix, setMatrix]     = useState(null);
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [authErr, setAuthErr]   = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const scrollRef = useRef(null);

  const scrollBottom = () => setTimeout(() => scrollRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 120);

  useEffect(() => {
    if (!supaUser) return;
    loadQuestion();
    supabase.from("user_matrix_scores").select("*").eq("user_id", supaUser.id).maybeSingle()
      .then(({ data }) => setMatrix(data));
  }, [supaUser]);

  async function loadQuestion() {
    const { data: answered } = await supabase
      .from("user_answers")
      .select("question_id")
      .eq("user_id", supaUser.id);

    const ids = (answered ?? []).map(a => a.question_id);
    let q = supabase.from("questions").select("*").order("layer").order("sort_order").limit(1);
    if (ids.length > 0) q = q.not("id", "in", `(${ids.map(id => `"${id}"`).join(",")})`);
    const { data } = await q;
    if (data?.[0]) { setQuestion(data[0]); setQVisible(true); }
  }

  async function submitQuestion(answer) {
    setQVisible(false);
    const q = question;
    setQuestion(null);

    let tags = [], braveryDelta = 0, curiosityDelta = 0;
    if (answer.option_id && q.options) {
      const opt = q.options.find(o => o.id === answer.option_id);
      tags = opt?.tags ?? [];
      braveryDelta  = opt?.matrix_delta?.bravery  ?? 0;
      curiosityDelta = opt?.matrix_delta?.curiosity ?? 0;
    }

    await supabase.from("user_answers").upsert(
      { user_id: supaUser.id, question_id: q.id, answer_text: answer.text, option_id: answer.option_id, answer_tags: tags },
      { onConflict: "user_id,question_id" }
    );

    if (braveryDelta !== 0 || curiosityDelta !== 0) {
      const { data: cur } = await supabase.from("user_matrix_scores").select("*").eq("user_id", supaUser.id).single();
      const newB = Math.min(1, Math.max(0, (cur?.bravery ?? 0.5) + braveryDelta));
      const newC = Math.min(1, Math.max(0, (cur?.curiosity ?? 0.5) + curiosityDelta));
      const arch = newB >= 0.65 && newC >= 0.65 ? "Pioneer" : newB >= 0.65 ? "Builder" : newC >= 0.65 ? "Sage" : "Anchor";
      await supabase.from("user_matrix_scores").upsert({ user_id: supaUser.id, bravery: newB, curiosity: newC, archetype: arch }, { onConflict: "user_id" });
      setMatrix({ bravery: newB, curiosity: newC, archetype: arch });
    }

    if (q.hook_after) {
      setMessages(prev => [...prev, { role: "assistant", content: q.hook_after }]);
      scrollBottom();
    }
    // Load next question after a pause
    setTimeout(loadQuestion, 2500);
  }

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setLoading(true);
    scrollBottom();

    try {
      const systemPrompt = buildCoachPrompt(matrix?.archetype, matrix?.bravery, matrix?.curiosity);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: systemPrompt,
          messages: next.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data?.error?.message || data?.error || `API error ${res.status}`;
        setMessages(prev => [...prev, { role: "assistant", content: `Something went wrong: ${errMsg}` }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: data?.content?.[0]?.text ?? "Lost the thread. Try again." }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Lost connection. Try again." }]);
    } finally {
      setLoading(false);
      scrollBottom();
    }
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password) { setAuthErr("Enter email and password."); return; }
    setAuthLoading(true); setAuthErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setAuthErr(error.message); }
    setAuthLoading(false);
  };

  // Gated behind auth
  if (!supaUser) {
    return (
      <div style={{ padding: "40px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: C.ocean, fontFamily: "monospace" }}>💬 COACH</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: C.pearl, margin: 0, lineHeight: 1.3 }}>
          Your AI career coach.
        </h2>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.75, margin: 0 }}>
          Answer questions, build your profile, get coaching that actually knows your matrix position.
          Sign in to unlock it.
        </p>
        <div style={{ padding: "20px 18px", borderRadius: 14, background: C.surface, border: `1px solid ${C.border}` }}>
          <input type="email" placeholder="your email" value={email} onChange={e => setEmail(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 13px", fontSize: 14, color: C.text, outline: "none", marginBottom: 8, fontFamily: "inherit" }}
          />
          <input type="password" placeholder="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSignIn()}
            style={{ width: "100%", boxSizing: "border-box", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 13px", fontSize: 14, color: C.text, outline: "none", marginBottom: authErr ? 8 : 12, fontFamily: "inherit" }}
          />
          {authErr && <div style={{ fontSize: 12, color: "#e07868", marginBottom: 10 }}>{authErr}</div>}
          <div onClick={handleSignIn} style={{ background: C.ocean, color: "#fff", textAlign: "center", padding: "12px 0", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, opacity: authLoading ? 0.6 : 1 }}>
            {authLoading ? "signing in..." : "sign in →"}
          </div>
        </div>
      </div>
    );
  }

  const showSeeds = messages.length === 1 && !qVisible;
  const accentColor = question ? (LAYER_COLORS[question.layer] ?? LAYER_COLORS[1]) : LAYER_COLORS[1];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Matrix mini header */}
      {matrix && (
        <div style={{ padding: "10px 20px 6px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${C.borderSoft}`, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${C.border}`, background: C.raised, position: "relative", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: C.border }} />
            <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: C.border }} />
            <div style={{ position: "absolute", width: 7, height: 7, borderRadius: "50%", background: C.ocean, marginLeft: -3, marginTop: -3, left: `${(matrix.bravery ?? 0.5) * 100}%`, top: `${(1 - (matrix.curiosity ?? 0.5)) * 100}%` }} />
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            {matrix.archetype ?? "Pioneer"} · {
              matrix.bravery >= 0.65 ? "high bravery" : matrix.bravery >= 0.45 ? "mid bravery" : "building bravery"
            }, {
              matrix.curiosity >= 0.65 ? "high curiosity" : matrix.curiosity >= 0.45 ? "mid curiosity" : "building curiosity"
            }
          </div>
        </div>
      )}

      {/* Question card */}
      {qVisible && question && (
        <div style={{
          margin: "12px 16px 2px", padding: "18px", borderRadius: 14,
          background: C.surface, border: `1px solid ${C.border}`, borderLeftWidth: 3, borderLeftColor: accentColor,
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 8, letterSpacing: 2, color: accentColor, marginBottom: 10, fontFamily: "monospace" }}>
            {LAYER_LABELS[question.layer] ?? "QUESTION"}
          </div>
          <div style={{ fontSize: 15, color: C.pearl, lineHeight: 1.65, marginBottom: 16 }}>{question.body}</div>
          <QuestionInput question={question} accentColor={accentColor} onSubmit={submitQuestion} onSkip={() => { setQVisible(false); setQuestion(null); }} />
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            maxWidth: "85%", padding: "13px 16px", borderRadius: 14, fontSize: 14, lineHeight: 1.65,
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            background: m.role === "user" ? C.ocean : C.surface,
            color: m.role === "user" ? "#fff" : C.text,
            border: m.role === "user" ? "none" : `1px solid ${C.border}`,
          }}>
            {m.role === "assistant" && <div style={{ fontSize: 8, letterSpacing: 2, color: C.dim, marginBottom: 6, fontFamily: "monospace" }}>COVE</div>}
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={{ maxWidth: "85%", padding: "13px 16px", borderRadius: 14, background: C.surface, border: `1px solid ${C.border}`, alignSelf: "flex-start" }}>
            <div style={{ fontSize: 8, letterSpacing: 2, color: C.dim, marginBottom: 6, fontFamily: "monospace" }}>COVE</div>
            <span style={{ fontSize: 18, color: C.dim, letterSpacing: 4 }}>· · ·</span>
          </div>
        )}
        {showSeeds && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {COACH_SEED_PROMPTS.map((p, i) => (
              <div key={i} onClick={() => setInput(p)} style={{
                padding: "13px 16px", borderRadius: 12, cursor: "pointer",
                background: C.surface, border: `1px solid ${C.border}`,
                fontSize: 13, color: C.muted, lineHeight: 1.5,
              }}>{p}</div>
            ))}
          </div>
        )}
      </div>

      {/* Input row */}
      <div style={{ display: "flex", gap: 10, padding: "12px 16px", borderTop: `1px solid ${C.borderSoft}`, background: C.surface, flexShrink: 0, alignItems: "flex-end" }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="say anything..."
          rows={1}
          style={{
            flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10,
            padding: "11px 13px", fontSize: 14, color: C.text, outline: "none", resize: "none",
            fontFamily: "inherit", lineHeight: 1.5, maxHeight: 100,
          }}
        />
        <div onClick={send} style={{
          width: 40, height: 40, borderRadius: 10, background: input.trim() && !loading ? C.ocean : C.faint,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: input.trim() && !loading ? "pointer" : "default",
          fontSize: 18, color: input.trim() && !loading ? "#fff" : C.dim, flexShrink: 0,
          transition: "background 0.15s",
        }}>→</div>
      </div>
    </div>
  );
}

// Extracted input widget for CoachTab questions
function QuestionInput({ question, accentColor, onSubmit, onSkip }) {
  const [openText, setOpenText] = useState("");
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    const isChoice = question.input_type === "choice";
    if (isChoice && !selected) return;
    if (!isChoice && !openText.trim()) return;
    setSubmitting(true);
    await onSubmit(isChoice ? { option_id: selected } : { text: openText.trim() });
  };

  if (question.input_type === "choice" && question.options) {
    return (
      <div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 12 }}>
          {question.options.map(opt => (
            <div key={opt.id} onClick={() => setSelected(opt.id)} style={{
              padding: "12px 14px", borderRadius: 10, cursor: "pointer",
              border: `1px solid ${selected === opt.id ? accentColor : C.border}`,
              background: selected === opt.id ? accentColor + "12" : C.raised,
              fontSize: 13, color: selected === opt.id ? C.pearl : C.muted, lineHeight: 1.5,
              transition: "all 0.15s",
            }}>{opt.text}</div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div onClick={handleSubmit} style={{ padding: "10px 18px", borderRadius: 10, background: accentColor + "15", border: `1px solid ${accentColor}40`, cursor: "pointer", fontSize: 13, fontWeight: 500, color: accentColor, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? "..." : "answer"}
          </div>
          <div onClick={onSkip} style={{ fontSize: 12, color: C.dim, cursor: "pointer", padding: "8px" }}>not now</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <textarea value={openText} onChange={e => setOpenText(e.target.value)} placeholder="type your answer..." rows={3}
        style={{ width: "100%", boxSizing: "border-box", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 13px", fontSize: 13, color: C.text, outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.55, marginBottom: 10 }}
      />
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div onClick={handleSubmit} style={{ padding: "10px 18px", borderRadius: 10, background: accentColor + "15", border: `1px solid ${accentColor}40`, cursor: "pointer", fontSize: 13, fontWeight: 500, color: accentColor, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? "..." : "answer"}
        </div>
        <div onClick={onSkip} style={{ fontSize: 12, color: C.dim, cursor: "pointer", padding: "8px" }}>not now</div>
      </div>
    </div>
  );
}

// ── Matches Tab ────────────────────────────────────────────────────────────────
function MatchesTab({ supaUser, userData }) {
  const [users, setUsers]       = useState([]);
  const [myCount, setMyCount]   = useState(0);
  const [loading, setLoading]   = useState(true);
  const [sortBy, setSortBy]     = useState("similarity");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [authErr, setAuthErr]   = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (!supaUser) return;
    loadMatches();
  }, [supaUser, sortBy]);

  async function loadMatches() {
    setLoading(true);
    const { count } = await supabase.from("user_answers").select("id", { count: "exact", head: true }).eq("user_id", supaUser.id);
    setMyCount(count ?? 0);

    const { data } = await supabase
      .from("similar_minds")
      .select("*")
      .eq("viewer_id", supaUser.id)
      .order(sortBy === "overlap" ? "overlap_count" : "similarity_score", { ascending: false })
      .limit(20);

    setUsers(data ?? []);
    setLoading(false);
  }

  const handleSignIn = async () => {
    if (!email.trim() || !password) { setAuthErr("Enter email and password."); return; }
    setAuthLoading(true); setAuthErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setAuthErr(error.message); }
    setAuthLoading(false);
  };

  if (!supaUser) {
    return (
      <div style={{ padding: "40px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: C.ocean, fontFamily: "monospace" }}>◎ MATCHES</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: C.pearl, margin: 0, lineHeight: 1.3 }}>
          See who matches your matrix.
        </h2>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.75, margin: 0 }}>
          Answer questions to build your profile. We'll surface people with similar positions, similar answers, similar ambitions. Sign in to see yours.
        </p>
        <div style={{ padding: "20px 18px", borderRadius: 14, background: C.surface, border: `1px solid ${C.border}` }}>
          <input type="email" placeholder="your email" value={email} onChange={e => setEmail(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 13px", fontSize: 14, color: C.text, outline: "none", marginBottom: 8, fontFamily: "inherit" }}
          />
          <input type="password" placeholder="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSignIn()}
            style={{ width: "100%", boxSizing: "border-box", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 13px", fontSize: 14, color: C.text, outline: "none", marginBottom: authErr ? 8 : 12, fontFamily: "inherit" }}
          />
          {authErr && <div style={{ fontSize: 12, color: "#e07868", marginBottom: 10 }}>{authErr}</div>}
          <div onClick={handleSignIn} style={{ background: C.ocean, color: "#fff", textAlign: "center", padding: "12px 0", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, opacity: authLoading ? 0.6 : 1 }}>
            {authLoading ? "signing in..." : "sign in →"}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: "60px 24px", textAlign: "center", color: C.dim, fontSize: 13 }}>
        loading your matches...
      </div>
    );
  }

  if (myCount < 3) {
    return (
      <div style={{ padding: "40px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: C.ocean, fontFamily: "monospace" }}>◎ MATCHES</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: C.pearl, margin: 0, lineHeight: 1.3 }}>Answer a few more questions first.</h2>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.75, margin: 0 }}>
          You've answered {myCount} {myCount === 1 ? "question" : "questions"}. We need at least 3 to find meaningful matches. Head to the Coach tab to keep going.
        </p>
        <div style={{ padding: "18px 20px", borderRadius: 14, background: C.surface, border: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i <= myCount ? C.ocean : C.faint }} />
            ))}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>{myCount}/3 answered</div>
        </div>
      </div>
    );
  }

  const archetypeColors = { Pioneer: "#1e6fa8", Builder: "#c2410c", Sage: "#0f766e", Anchor: "#7c3aed" };

  return (
    <div style={{ padding: "0 0 80px" }}>
      <div style={{ padding: "20px 24px 12px" }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: C.ocean, fontFamily: "monospace", marginBottom: 8 }}>◎ MATCHES</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.pearl, margin: "0 0 4px" }}>Similar minds.</h2>
        <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>People who answered like you did.</p>
      </div>

      {/* Sort toggle */}
      <div style={{ display: "flex", gap: 8, padding: "0 24px", marginBottom: 16 }}>
        {[{ id: "similarity", label: "closest match" }, { id: "overlap", label: "most overlap" }].map(s => (
          <div key={s.id} onClick={() => setSortBy(s.id)} style={{
            padding: "7px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12,
            background: sortBy === s.id ? C.ocean : C.surface,
            color: sortBy === s.id ? "#fff" : C.muted,
            border: `1px solid ${sortBy === s.id ? C.ocean : C.border}`,
            transition: "all 0.15s",
          }}>{s.label}</div>
        ))}
      </div>

      {users.length === 0 ? (
        <div style={{ padding: "40px 24px", textAlign: "center", color: C.muted, fontSize: 14 }}>
          No matches yet — you might be one of the first. Keep answering questions.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 20px" }}>
          {users.map((u, i) => {
            const pct = Math.round((u.similarity_score ?? 0) * 100);
            const accentColor = archetypeColors[u.candidate_archetype] ?? C.ocean;
            return (
              <div key={i} style={{
                padding: "16px 18px", borderRadius: 14,
                background: C.surface, border: `1px solid ${C.border}`,
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: C.pearl, marginBottom: 3 }}>{u.candidate_name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{u.candidate_school} · {u.candidate_grad_year}</div>
                  </div>
                  <div style={{
                    padding: "5px 10px", borderRadius: 20,
                    background: accentColor + "15", border: `1px solid ${accentColor}40`,
                    fontSize: 11, fontWeight: 600, color: accentColor,
                  }}>
                    {u.candidate_archetype ?? "—"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1, padding: "8px 10px", borderRadius: 8, background: C.bg, border: `1px solid ${C.borderSoft}`, textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 300, color: C.ocean, marginBottom: 2 }}>{pct}%</div>
                    <div style={{ fontSize: 9, color: C.dim, letterSpacing: 0.5, fontFamily: "monospace" }}>SIMILAR</div>
                  </div>
                  <div style={{ flex: 1, padding: "8px 10px", borderRadius: 8, background: C.bg, border: `1px solid ${C.borderSoft}`, textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 300, color: C.ocean, marginBottom: 2 }}>{u.overlap_count}</div>
                    <div style={{ fontSize: 9, color: C.dim, letterSpacing: 0.5, fontFamily: "monospace" }}>SHARED Q's</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Vibes Tab ─────────────────────────────────────────────────────────────────
function VibesTab() {
  const visible = useFadeIn(["vibes"]);

  // left column, right column — alternating creates masonry chaos
  const left = [
    {
      type: "img", src: "/water.jpg",
      caption: "your current.", rotate: -1.5,
      height: 140,
    },
    {
      type: "quote",
      text: "it's time to try\ndefying gravity.",
      bg: "#f5d66e", color: "#1a1000",
      font: "Georgia, serif", size: 20, weight: 700,
      rotate: 2, pad: "22px 18px", minH: 120,
    },
    {
      type: "quote",
      text: '"no problem.........."',
      bg: "#fff", color: "#333",
      font: "Georgia, serif", size: 15, weight: 400,
      rotate: -2.5, pad: "18px 16px", minH: 90,
      border: "1.5px solid #ddd",
    },
    {
      type: "quote",
      text: "what a privilege it is to see progress,\neven if no one else does.",
      bg: "#e8f5e8", color: "#1a3a1a",
      font: "Georgia, serif", size: 13, weight: 400,
      rotate: 1, pad: "20px 16px", minH: 110,
      italic: true,
    },
    {
      type: "quote",
      text: "you're not desperate.\nyou're selective.",
      bg: C.ocean, color: "#fff",
      font: "Georgia, serif", size: 16, weight: 600,
      rotate: -1.5, pad: "22px 18px", minH: 100,
    },
  ];

  const right = [
    {
      type: "quote",
      text: "Flip it\naround",
      bg: "#111", color: "#fff",
      font: "Georgia, serif", size: 28, weight: 700,
      rotate: 3, pad: "28px 20px", minH: 130,
    },
    {
      type: "quote",
      text: "slow rider.\nstill riding. 🦥",
      bg: "#a8d8f0", color: "#0a2030",
      font: "Georgia, serif", size: 17, weight: 600,
      rotate: -2, pad: "20px 16px", minH: 100,
    },
    {
      type: "quote",
      text: "good morning\npackmates 🐺",
      bg: "#1a1a2e", color: "#e0d0ff",
      font: "Georgia, serif", size: 15, weight: 400,
      rotate: 2.5, pad: "18px 16px", minH: 90,
    },
    {
      type: "quote",
      text: "a real person\nmakes their\nown luck.",
      bg: "#222", color: "#f0f0f0",
      font: "monospace", size: 14, weight: 700,
      rotate: -1, pad: "20px 16px", minH: 110,
      letterSpacing: 1,
    },
    {
      type: "add",
      rotate: 1.5, minH: 80,
    },
  ];

  const renderCard = (card, i) => {
    const base = {
      borderRadius: 12,
      transform: `rotate(${card.rotate}deg)`,
      marginBottom: 10,
      boxShadow: "0 3px 14px rgba(0,0,0,0.10)",
      overflow: "hidden",
      display: "block",
    };

    if (card.type === "img") return (
      <div key={i} style={{ ...base, height: card.height, position: "relative" }}>
        <img src={card.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {card.caption && (
          <div style={{
            position: "absolute", bottom: 8, left: 10,
            fontSize: 10, fontFamily: "monospace", letterSpacing: 2,
            color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.6)",
          }}>{card.caption}</div>
        )}
      </div>
    );

    if (card.type === "add") return (
      <div key={i} style={{
        ...base,
        minHeight: card.minH,
        background: "#fff",
        border: "2px dashed #ccc",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#aaa", fontSize: 13, cursor: "pointer",
        fontFamily: "monospace",
      }}>+ add yours</div>
    );

    return (
      <div key={i} style={{
        ...base,
        background: card.bg,
        border: card.border || "none",
        minHeight: card.minH,
        padding: card.pad,
      }}>
        <div style={{
          fontFamily: card.font,
          fontSize: card.size,
          fontWeight: card.weight,
          fontStyle: card.italic ? "italic" : "normal",
          color: card.color,
          lineHeight: 1.4,
          letterSpacing: card.letterSpacing || 0,
          whiteSpace: "pre-line",
        }}>{card.text}</div>
      </div>
    );
  };

  return (
    <div style={{ ...fadeStyle(visible), background: C.bg, minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ padding: "20px 18px 10px", display: "flex", alignItems: "baseline", gap: 10 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: C.pearl, fontFamily: "Georgia, serif" }}>Vibes</h2>
        <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 2 }}>board</span>
      </div>

      {/* Masonry board — 2 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px", padding: "8px 12px 40px", alignItems: "start" }}>
        <div>{left.map(renderCard)}</div>
        <div style={{ marginTop: 24 }}>{right.map(renderCard)}</div>
      </div>
    </div>
  );
}

// ── List of 100 Tab ───────────────────────────────────────────────────────────
const ATTEMPT_STATUSES = ["—", "sent", "replied", "call", "pass"];
const ATTEMPT_COLORS   = { sent: C.ocean, replied: "#6dbb8a", call: "#c4a040", pass: C.muted };

function makeEntry(firstName = "", lastName = "") {
  return {
    id: Date.now() + Math.random(),
    firstName, lastName,
    company: "", email: "", phone: "", linkedin: "",
    why: "", ask: "",
    attempt1: "", attempt2: "",
    warm: "warm", notes: "",
    added: new Date().toLocaleDateString(),
  };
}

function List100Tab({ userData, onListSave }) {
  const [entries, setEntries] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("cove_list100") || "[]");
      // Migrate old-format entries (had "name" field instead of firstName/lastName)
      const migrated = saved.map(e => e.firstName !== undefined ? e : {
        ...makeEntry(),
        id: e.id,
        firstName: (e.contact || e.name || "").split(" ")[0] || "",
        lastName:  (e.contact || e.name || "").split(" ").slice(1).join(" ") || "",
        company:   e.name || "",
        why:       e.focus || "",
        notes:     e.notes || "",
        warm:      e.warm || "warm",
        added:     e.added || "",
      });
      // Import from onboarding contacts (dedupe by full name)
      const contacts = userData?.contacts || [];
      const existing = new Set(migrated.map(e => `${e.firstName} ${e.lastName}`.trim().toLowerCase()));
      const imported = contacts
        .filter(c => c.name && !existing.has(c.name.trim().toLowerCase()))
        .map(c => {
          const parts = c.name.trim().split(" ");
          return makeEntry(parts[0] || "", parts.slice(1).join(" ") || "");
        });
      return [...imported, ...migrated];
    } catch { return []; }
  });

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("cove_list_dark") === "1");
  const toggleDark = () => setDarkMode(d => {
    const next = !d;
    localStorage.setItem("cove_list_dark", next ? "1" : "0");
    return next;
  });

  const D = darkMode ? {
    bg:         "#0b0f14",
    surface:    "#131920",
    raised:     "#1a2230",
    border:     "#2a3a4a",
    borderSoft: "#1e2e3e",
    text:       "#c8dae8",
    muted:      "#7a9ab0",
    faint:      "#141e28",
    dim:        "#5a7888",
    ocean:      "#4a9eca",
    oceanDeep:  "#2a7aaa",
    seafoam:    "#3aaa92",
    sky:        "#4e98c8",
    mist:       "#6e90a8",
    tide:       "#4e90b0",
    pearl:      "#ddeeff",
  } : C;

  const [view, setView]         = useState("cards");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);
  const [form, setForm]         = useState(makeEntry());
  const [toast, setToast]       = useState(null);
  const toastTimer              = useRef(null);

  const save = (next) => {
    setEntries(next);
    localStorage.setItem("cove_list100", JSON.stringify(next));
    onListSave?.(next);
  };

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  const openAdd = () => {
    setEditId(null);
    setForm(makeEntry());
    setShowForm(true);
  };

  const openEdit = (e) => {
    setEditId(e.id);
    setForm({ ...e });
    setShowForm(true);
  };

  const saveForm = () => {
    const fullName = `${form.firstName} ${form.lastName}`.trim();
    if (!fullName) { showToast("add a name first"); return; }
    if (editId) {
      save(entries.map(e => e.id === editId ? { ...form } : e));
      showToast("saved");
    } else {
      save([{ ...form, id: Date.now() + Math.random(), added: new Date().toLocaleDateString() }, ...entries]);
      showToast(`${fullName} added`);
    }
    setShowForm(false);
    setEditId(null);
  };

  const deleteEntry = (id) => save(entries.filter(e => e.id !== id));

  const cycleAttempt = (id, field) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    const cur = entry[field] || "—";
    const next = ATTEMPT_STATUSES[(ATTEMPT_STATUSES.indexOf(cur) + 1) % ATTEMPT_STATUSES.length];
    save(entries.map(e => e.id === id ? { ...e, [field]: next } : e));
  };

  const exportCSV = () => {
    if (!entries.length) { showToast("nothing to export yet"); return; }
    const headers = ["First Name","Last Name","Company","Email","Phone","LinkedIn","Why","Ask","Attempt 1","Attempt 2","Warm/Cold","Notes","Added"];
    const rows = entries.map(e => [
      e.firstName, e.lastName, e.company, e.email, e.phone, e.linkedin,
      e.why, e.ask, e.attempt1, e.attempt2, e.warm, e.notes, e.added,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v||"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `cove_list_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    showToast(`exported ${entries.length} entries`);
  };

  const pct      = Math.min((entries.length / 100) * 100, 100);
  const warm     = entries.filter(e => e.warm === "warm").length;
  const reached  = entries.filter(e => e.attempt1 && e.attempt1 !== "—").length;

  const inputStyle = {
    width: "100%", background: D.bg, border: `1px solid ${D.border}`,
    borderRadius: 8, padding: "10px 12px", fontSize: 13,
    color: D.text, outline: "none", fontFamily: "Georgia, serif",
    boxSizing: "border-box",
  };

  // ── Entry card ────────────────────────────────────────────────────────────
  const EntryCard = ({ e }) => {
    const fullName = `${e.firstName} ${e.lastName}`.trim();
    const a1Color  = ATTEMPT_COLORS[e.attempt1] || D.dim;
    const a2Color  = ATTEMPT_COLORS[e.attempt2] || D.dim;
    return (
      <div style={{
        background: D.surface, borderRadius: 12,
        border: `1px solid ${D.borderSoft}`,
        borderLeft: `3px solid ${e.warm === "warm" ? "#c47020" : D.border}`,
        padding: "14px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 15, color: D.pearl, fontWeight: 500 }}>{fullName || "—"}</div>
            {e.company && <div style={{ fontSize: 12, color: D.muted, marginTop: 2 }}>{e.company}</div>}
          </div>
          <div style={{ display: "flex", gap: 12, flexShrink: 0, marginLeft: 12 }}>
            <span onClick={() => openEdit(e)} style={{ fontSize: 11, color: D.muted, cursor: "pointer", fontFamily: "monospace" }}>edit</span>
            <span onClick={() => deleteEntry(e.id)} style={{ fontSize: 13, color: D.dim, cursor: "pointer" }}>✕</span>
          </div>
        </div>
        {e.why && (
          <div style={{ fontSize: 12, color: D.muted, marginBottom: 3, lineHeight: 1.6 }}>
            <span style={{ color: D.dim, fontFamily: "monospace", fontSize: 9, marginRight: 6, letterSpacing: 1 }}>WHY</span>{e.why}
          </div>
        )}
        {e.ask && (
          <div style={{ fontSize: 12, color: D.muted, marginBottom: 8, lineHeight: 1.6 }}>
            <span style={{ color: D.dim, fontFamily: "monospace", fontSize: 9, marginRight: 6, letterSpacing: 1 }}>ASK</span>{e.ask}
          </div>
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{
            fontSize: 10, fontFamily: "monospace", padding: "3px 8px", borderRadius: 20,
            background: e.warm === "warm" ? "#c4702018" : `${D.ocean}10`,
            color: e.warm === "warm" ? "#c47020" : D.muted,
            border: `1px solid ${e.warm === "warm" ? "#c4702030" : D.border}`,
          }}>
            {e.warm === "warm" ? "🔥 warm" : "❄️ cold"}
          </span>
          <span onClick={() => cycleAttempt(e.id, "attempt1")} title="click to cycle" style={{
            fontSize: 10, fontFamily: "monospace", padding: "3px 8px", borderRadius: 20, cursor: "pointer",
            background: e.attempt1 && e.attempt1 !== "—" ? `${a1Color}15` : "transparent",
            color: e.attempt1 && e.attempt1 !== "—" ? a1Color : D.dim,
            border: `1px solid ${e.attempt1 && e.attempt1 !== "—" ? a1Color + "50" : D.border}`,
          }}>
            {e.attempt1 && e.attempt1 !== "—" ? `A1: ${e.attempt1}` : "A1 —"}
          </span>
          <span onClick={() => cycleAttempt(e.id, "attempt2")} title="click to cycle" style={{
            fontSize: 10, fontFamily: "monospace", padding: "3px 8px", borderRadius: 20, cursor: "pointer",
            background: e.attempt2 && e.attempt2 !== "—" ? `${a2Color}15` : "transparent",
            color: e.attempt2 && e.attempt2 !== "—" ? a2Color : D.dim,
            border: `1px solid ${e.attempt2 && e.attempt2 !== "—" ? a2Color + "50" : D.border}`,
          }}>
            {e.attempt2 && e.attempt2 !== "—" ? `A2: ${e.attempt2}` : "A2 —"}
          </span>
          {e.linkedin && (
            <a href={e.linkedin.startsWith("http") ? e.linkedin : `https://${e.linkedin}`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 10, color: D.tide, fontFamily: "monospace", textDecoration: "none" }}>in ↗</a>
          )}
        </div>
        {e.notes && <div style={{ fontSize: 11, color: D.dim, fontStyle: "italic", marginTop: 8, lineHeight: 1.6 }}>{e.notes}</div>}
        <div style={{ fontSize: 9, color: D.dim, fontFamily: "monospace", marginTop: 6, opacity: 0.5 }}>{e.added}</div>
      </div>
    );
  };

  // ── Table row ─────────────────────────────────────────────────────────────
  const TableRow = ({ e, i }) => {
    const fullName = `${e.firstName} ${e.lastName}`.trim();
    const a1Color  = ATTEMPT_COLORS[e.attempt1] || D.dim;
    const a2Color  = ATTEMPT_COLORS[e.attempt2] || D.dim;
    return (
      <div style={{
        display: "grid", gridTemplateColumns: "28px 1fr 80px 56px 56px 32px",
        gap: 8, alignItems: "center",
        padding: "9px 0", borderBottom: `1px solid ${D.borderSoft}`,
      }}>
        <span style={{ color: D.dim, fontFamily: "monospace", fontSize: 10 }}>{i + 1}</span>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 13, color: D.text }}>{fullName || "—"}</span>
          {e.company && <span style={{ fontSize: 11, color: D.dim, marginLeft: 8 }}>{e.company}</span>}
        </div>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: e.warm === "warm" ? "#c47020" : D.muted }}>
          {e.warm === "warm" ? "🔥 warm" : "❄️ cold"}
        </span>
        <span onClick={() => cycleAttempt(e.id, "attempt1")} style={{
          fontSize: 10, fontFamily: "monospace", cursor: "pointer",
          color: e.attempt1 && e.attempt1 !== "—" ? a1Color : D.dim,
        }}>
          {e.attempt1 && e.attempt1 !== "—" ? e.attempt1 : "—"}
        </span>
        <span onClick={() => cycleAttempt(e.id, "attempt2")} style={{
          fontSize: 10, fontFamily: "monospace", cursor: "pointer",
          color: e.attempt2 && e.attempt2 !== "—" ? a2Color : D.dim,
        }}>
          {e.attempt2 && e.attempt2 !== "—" ? e.attempt2 : "—"}
        </span>
        <span onClick={() => openEdit(e)} style={{ fontSize: 11, color: D.muted, fontFamily: "monospace", cursor: "pointer" }}>edit</span>
      </div>
    );
  };


  return (
    <div style={{ padding: "24px 20px 0", background: D.bg, minHeight: "100%" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <SectionLabel>your list</SectionLabel>
          <div style={{ fontSize: 20, color: D.pearl, fontWeight: 400 }}>Your reach-out list</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 24, color: D.ocean, fontWeight: 400 }}>
              {entries.length}
            </div>
            <div style={{ fontSize: 10, color: D.muted, fontFamily: "monospace" }}>
              {warm} warm · {reached} reached
            </div>
          </div>
          <div
            onClick={toggleDark}
            title={darkMode ? "switch to light" : "switch to dark"}
            style={{
              cursor: "pointer", fontSize: 16, lineHeight: 1,
              padding: "4px 6px", borderRadius: 8,
              background: D.raised, border: `1px solid ${D.border}`,
              color: D.muted, userSelect: "none",
            }}
          >
            {darkMode ? "☀︎" : "◑"}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: D.borderSoft, borderRadius: 4, marginBottom: 20, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: `linear-gradient(90deg, ${D.oceanDeep}, ${D.ocean})`,
          borderRadius: 4, transition: "width 0.4s ease",
        }} />
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center" }}>
        <div onClick={openAdd} style={{
          flex: 1, display: "flex", alignItems: "center", gap: 8,
          padding: "11px 16px", borderRadius: 10,
          border: `1px dashed ${D.ocean}60`, cursor: "pointer",
          color: D.ocean, fontSize: 13,
        }}>
          <span style={{ fontSize: 16 }}>+</span> add contact
        </div>
        <div style={{ display: "flex", background: D.surface, borderRadius: 8, border: `1px solid ${D.border}`, overflow: "hidden" }}>
          {[{ v: "cards", icon: "⊞" }, { v: "table", icon: "≡" }].map(({ v, icon }) => (
            <div key={v} onClick={() => setView(v)} style={{
              padding: "8px 13px", cursor: "pointer", fontSize: 14,
              background: view === v ? D.raised : "transparent",
              color: view === v ? D.ocean : D.muted,
            }}>{icon}</div>
          ))}
        </div>
        {entries.length > 0 && (
          <div onClick={exportCSV} style={{ fontSize: 11, color: D.muted, fontFamily: "monospace", cursor: "pointer", padding: "8px 10px" }} title="export csv">⬇</div>
        )}
      </div>

      {/* Empty state */}
      {entries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "56px 0 32px" }}>
          <div style={{ fontSize: 36, marginBottom: 16, opacity: 0.4 }}>◉</div>
          <div style={{ fontSize: 14, color: D.muted, marginBottom: 6 }}>your list is empty</div>
          <div style={{ fontSize: 12, color: D.dim }}>add the people you want in your corner</div>
        </div>
      ) : view === "cards" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 32 }}>
          {entries.map(e => <EntryCard key={e.id} e={e} />)}
        </div>
      ) : (
        <div style={{ paddingBottom: 32 }}>
          <div style={{
            display: "grid", gridTemplateColumns: "28px 1fr 80px 56px 56px 32px",
            gap: 8, padding: "0 0 8px", borderBottom: `1px solid ${D.border}`,
          }}>
            {["#", "NAME", "LEAD", "A1", "A2", ""].map((h, i) => (
              <span key={i} style={{ fontSize: 9, color: D.dim, fontFamily: "monospace", letterSpacing: 1 }}>{h}</span>
            ))}
          </div>
          {entries.map((e, i) => <TableRow key={e.id} e={e} i={i} />)}
        </div>
      )}

      {showForm && (
    <div style={{
      position: "fixed", inset: 0, background: "#000000cc",
      zIndex: 200, display: "flex", alignItems: "flex-end",
    }} onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
      <div style={{
        width: "100%", maxHeight: "88vh", overflowY: "auto",
        background: D.surface, borderRadius: "20px 20px 0 0",
        padding: "24px 20px 44px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: 2, color: D.muted }}>
            {editId ? "EDIT CONTACT" : "ADD CONTACT"}
          </span>
          <span onClick={() => setShowForm(false)} style={{ color: D.muted, cursor: "pointer", fontSize: 18 }}>✕</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
            placeholder="First name" autoComplete="off" style={inputStyle} />
          <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
            placeholder="Last name" autoComplete="off" style={inputStyle} />
        </div>
        <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
          placeholder="Company / Organization" autoComplete="off" style={{ ...inputStyle, marginBottom: 8 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="Email" autoComplete="off" style={inputStyle} />
          <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="Phone" autoComplete="off" style={inputStyle} />
        </div>
        <input value={form.linkedin} onChange={e => setForm(f => ({ ...f, linkedin: e.target.value }))}
          placeholder="LinkedIn URL" autoComplete="off" style={{ ...inputStyle, marginBottom: 8 }} />
        <textarea value={form.why} onChange={e => setForm(f => ({ ...f, why: e.target.value }))}
          placeholder="Why this person? What do you admire or want to learn?" rows={2}
          style={{ ...inputStyle, resize: "none", lineHeight: 1.6, marginBottom: 8 }} />
        <textarea value={form.ask} onChange={e => setForm(f => ({ ...f, ask: e.target.value }))}
          placeholder="What's the ask? Coffee chat, referral, advice, intro..." rows={2}
          style={{ ...inputStyle, resize: "none", lineHeight: 1.6, marginBottom: 12 }} />

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {[{ val: "warm", label: "🔥 warm" }, { val: "cold", label: "❄️ cold" }].map(p => (
            <div key={p.val} onClick={() => setForm(f => ({ ...f, warm: p.val }))} style={{
              flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 8, cursor: "pointer",
              fontSize: 12, fontFamily: "monospace",
              border: `1px solid ${form.warm === p.val ? (p.val === "warm" ? "#c47020" : D.ocean) : D.border}`,
              background: form.warm === p.val ? (p.val === "warm" ? "#c4702015" : `${D.ocean}15`) : "transparent",
              color: form.warm === p.val ? (p.val === "warm" ? "#c47020" : D.ocean) : D.muted,
            }}>{p.label}</div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {[{ field: "attempt1", label: "ATTEMPT 1" }, { field: "attempt2", label: "ATTEMPT 2" }].map(({ field, label }) => (
            <div key={field}>
              <div style={{ fontSize: 9, color: D.dim, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {ATTEMPT_STATUSES.map(s => (
                  <div key={s} onClick={() => setForm(f => ({ ...f, [field]: s }))} style={{
                    padding: "4px 9px", borderRadius: 20, cursor: "pointer", fontSize: 11, fontFamily: "monospace",
                    border: `1px solid ${form[field] === s ? (ATTEMPT_COLORS[s] || D.muted) + "80" : D.border}`,
                    background: form[field] === s ? `${ATTEMPT_COLORS[s] || D.muted}15` : "transparent",
                    color: form[field] === s ? (ATTEMPT_COLORS[s] || D.muted) : D.dim,
                  }}>{s}</div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Notes..." rows={2}
          style={{ ...inputStyle, resize: "none", lineHeight: 1.6, marginBottom: 16 }} />
        <Btn onClick={saveForm} style={{ width: "100%" }}>{editId ? "save changes" : "+ add to list"}</Btn>
      </div>
    </div>
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
          background: D.raised, border: `1px solid ${D.border}`, color: D.pearl,
          padding: "10px 20px", borderRadius: 8, fontSize: 13, fontFamily: "Georgia, serif",
          zIndex: 999, whiteSpace: "nowrap",
        }}>{toast}</div>
      )}
    </div>
  );
}



// eslint-disable-next-line no-unused-vars
function Field({ placeholder, value, onChange }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        flex: 1, background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: "14px 16px", fontSize: 14,
        color: C.text, outline: "none", fontFamily: "Georgia, serif",
        transition: "border-color 0.2s",
        borderColor: value ? C.ocean : C.border,
        minWidth: 0,
      }}
    />
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 9, color: C.muted, letterSpacing: 1.5,
      fontFamily: "monospace", textTransform: "uppercase",
      marginBottom: 12,
    }}>{children}</div>
  );
}

// ── You / Profile Tab ─────────────────────────────────────────────────────────
function ProfileTab({ userData, update, onReset, onSignOut, onGoToLogin, supaUser }) {
  const visible = useFadeIn(["you"]);
  const quadrant = userData.selfPosition ? getQuadrant(userData.selfPosition.x, userData.selfPosition.y) : null;
  const qr = quadrant ? QUADRANT_READS[quadrant] : null;
  const [confirming, setConfirming] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [editingLinkedin, setEditingLinkedin] = useState(false);
  const [linkedinDraft, setLinkedinDraft] = useState("");
  const photoInputRef = useRef(null);

  const saveEmail = async () => {
    const trimmed = emailDraft.trim();
    if (trimmed && !/\S+@\S+\.\S+/.test(trimmed)) { setEmailError("enter a valid email"); return; }
    setEmailSaving(true);
    update({ email: trimmed });
    await upsertProfile({ ...userData, email: trimmed });
    setEmailSaving(false);
    setEditingEmail(false);
    setEmailError("");
  };

  const saveLinkedin = async () => {
    const trimmed = linkedinDraft.trim();
    update({ linkedin: trimmed });
    setEditingLinkedin(false);
    await upsertProfile({ ...userData, linkedin: trimmed });
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const photoUrl = ev.target.result;
      update({ photoUrl });
      upsertProfile({ ...userData, photoUrl });
    };
    reader.readAsDataURL(file);
  };

  const row = (label, value) => value ? (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 9, letterSpacing: 2, color: C.muted, fontFamily: "monospace", margin: "0 0 5px" }}>{label}</p>
      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.7, margin: 0 }}>{value}</p>
    </div>
  ) : null;

  const inlineInput = (type, value, setValue, placeholder, onSave, onCancel) => (
    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
      <input
        autoFocus type={type} value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
        placeholder={placeholder}
        style={{ flex: 1, background: C.raised, border: `1px solid ${C.ocean}60`, borderRadius: 7, padding: "6px 10px", color: C.text, fontSize: 12, fontFamily: "inherit", outline: "none" }}
      />
      <button onClick={onSave} style={{ background: C.ocean, border: "none", borderRadius: 7, padding: "6px 12px", color: "#fff", fontSize: 11, cursor: "pointer", fontFamily: "monospace", letterSpacing: 0.5 }}>save</button>
      <button onClick={onCancel} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 8px", color: C.muted, fontSize: 11, cursor: "pointer" }}>✕</button>
    </div>
  );

  return (
    <div style={{ ...fadeStyle(visible), padding: "24px 20px 40px" }}>

      {/* Identity header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 28 }}>
        {/* Avatar */}
        <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
        <div
          onClick={() => photoInputRef.current?.click()}
          style={{ width: 58, height: 58, borderRadius: 29, flexShrink: 0, background: C.ocean + "18", border: `1.5px solid ${C.ocean}30`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden" }}
          title="tap to change photo"
        >
          {userData.photoUrl
            ? <img src={userData.photoUrl} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: 20, color: C.ocean + "80" }}>◉</span>
          }
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, paddingTop: 2 }}>
          <h2 style={{ fontSize: 22, fontWeight: 300, color: C.pearl, margin: "0 0 8px", lineHeight: 1 }}>{userData.name || "—"}</h2>

          {/* Email */}
          {editingEmail
            ? <>{inlineInput("email", emailDraft, v => { setEmailDraft(v); setEmailError(""); }, "your@email.com", saveEmail, () => { setEditingEmail(false); setEmailError(""); })}
                {emailError && <p style={{ fontSize: 10, color: "#e07070", margin: "3px 0 0", fontFamily: "monospace" }}>{emailError}</p>}</>
            : <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                {userData.email
                  ? <><span style={{ fontSize: 12, color: C.muted }}>{userData.email}</span>
                      <button onClick={() => { setEmailDraft(userData.email); setEditingEmail(true); }} style={{ background: "none", border: "none", padding: 0, color: C.dim, fontSize: 10, cursor: "pointer", fontFamily: "monospace" }}>edit</button></>
                  : <button onClick={() => { setEmailDraft(""); setEditingEmail(true); }} style={{ background: "none", border: "none", padding: 0, color: C.ocean + "99", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>+ add email</button>
                }
              </div>
          }

          {/* LinkedIn */}
          {editingLinkedin
            ? inlineInput("url", linkedinDraft, setLinkedinDraft, "linkedin.com/in/yourname", saveLinkedin, () => setEditingLinkedin(false))
            : <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {userData.linkedin
                  ? <><a href={userData.linkedin.startsWith("http") ? userData.linkedin : `https://${userData.linkedin}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.ocean, textDecoration: "none" }}>{userData.linkedin.replace(/^https?:\/\/(www\.)?/, "")}</a>
                      <button onClick={() => { setLinkedinDraft(userData.linkedin); setEditingLinkedin(true); }} style={{ background: "none", border: "none", padding: 0, color: C.dim, fontSize: 10, cursor: "pointer", fontFamily: "monospace" }}>edit</button></>
                  : <button onClick={() => { setLinkedinDraft(""); setEditingLinkedin(true); }} style={{ background: "none", border: "none", padding: 0, color: C.ocean + "99", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>+ add linkedin</button>
                }
              </div>
          }
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Matrix */}
        {qr && (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: C.surface, borderLeft: `2.5px solid ${qr.color}`, border: `1px solid ${qr.color}30` }}>
            <p style={{ fontSize: 9, letterSpacing: 2, color: C.dim, fontFamily: "monospace", margin: "0 0 4px" }}>YOUR MATRIX</p>
            <p style={{ fontSize: 15, fontWeight: 400, color: qr.color, margin: "0 0 4px" }}>{qr.title}</p>
            <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, margin: 0 }}>{qr.short}</p>
          </div>
        )}

        {/* Reflections */}
        {(userData.braveReflection || userData.fearsReflection) && (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: C.surface, border: `1px solid ${C.borderSoft}` }}>
            <p style={{ fontSize: 9, letterSpacing: 2, color: C.dim, fontFamily: "monospace", margin: "0 0 12px" }}>YOUR REFLECTIONS</p>
            {userData.braveReflection && (
              <div style={{ marginBottom: userData.fearsReflection ? 10 : 0 }}>
                <p style={{ fontSize: 9, letterSpacing: 1.5, color: C.dim, fontFamily: "monospace", margin: "0 0 3px" }}>THE BRAVE THING</p>
                <p style={{ fontSize: 13, color: C.text, lineHeight: 1.6, margin: 0 }}>{userData.braveReflection}</p>
              </div>
            )}
            {userData.fearsReflection && (
              <div>
                <p style={{ fontSize: 9, letterSpacing: 1.5, color: C.dim, fontFamily: "monospace", margin: "0 0 3px" }}>WHAT'S IN THE WAY</p>
                <p style={{ fontSize: 13, color: C.text, lineHeight: 1.6, margin: 0 }}>{userData.fearsReflection}</p>
              </div>
            )}
          </div>
        )}

        {/* List */}
        {userData.contacts?.length > 0 && (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: C.surface, border: `1px solid ${C.borderSoft}` }}>
            <p style={{ fontSize: 9, letterSpacing: 2, color: C.dim, fontFamily: "monospace", margin: "0 0 10px" }}>YOUR LIST ({userData.contacts.length})</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {userData.contacts.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 9, color: C.dim, fontFamily: "monospace", minWidth: 16 }}>{i + 1}</span>
                  <span style={{ fontSize: 13, color: C.text }}>{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* About Cove */}
      <div style={{ marginTop: 10, padding: "14px 16px", borderRadius: 12, background: C.surface, border: `1px solid ${C.borderSoft}`, display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: C.raised, border: `1px solid ${C.border}` }}>
          <img src="/fhiwa.jpg" alt="Fhiwa" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} onError={e => { e.target.style.display = "none"; }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 9, letterSpacing: 2, color: C.dim, fontFamily: "monospace", margin: "0 0 2px" }}>BUILT BY</p>
          <p style={{ fontSize: 13, color: C.pearl, margin: "0 0 6px", fontWeight: 400 }}>Fhiwa Ndou</p>
          <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.6, margin: "0 0 10px" }}>100% open-source. Built by those who went through it, and wanted something better.</p>
          <a href="https://github.com/sponsors/chieffhiwa" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: C.ocean, textDecoration: "none", fontFamily: "monospace", letterSpacing: 0.5 }}>contribute on github →</a>
        </div>
      </div>

      {/* Sign in / Sign out */}
      <div style={{ marginTop: 10 }}>
        {supaUser ? (
          <button
            onClick={onSignOut}
            style={{ background: "none", border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: "11px 20px", color: C.muted, fontSize: 11, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1, width: "100%" }}
          >sign out</button>
        ) : (
          <button
            onClick={onGoToLogin}
            style={{ background: "none", border: `1px solid ${C.ocean}60`, borderRadius: 10, padding: "11px 20px", color: C.ocean, fontSize: 11, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1, width: "100%" }}
          >sign in →</button>
        )}
      </div>

      {/* Reset */}
      <div style={{ marginTop: 10 }}>
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            style={{ background: "none", border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: "11px 20px", color: C.dim, fontSize: 11, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1, width: "100%" }}
          >start over / redo onboarding</button>
        ) : (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: C.surface, border: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 12, color: C.muted, margin: "0 0 12px", lineHeight: 1.6 }}>This will clear your local data and restart the flow. Your Supabase record stays intact.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirming(false)} style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px", color: C.muted, fontSize: 12, cursor: "pointer" }}>cancel</button>
              <button onClick={onReset} style={{ flex: 1, background: "#e07070", border: "none", borderRadius: 8, padding: "9px", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>yes, start over</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// fadeStyle is now imported from ./lib/hooks
