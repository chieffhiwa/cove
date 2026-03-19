import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import posthog from "posthog-js";

// ─── ANALYTICS ───────────────────────────────────────────────────────────────
const PH_KEY = process.env.REACT_APP_POSTHOG_KEY;
if (PH_KEY) posthog.init(PH_KEY, { api_host: "https://us.i.posthog.com", person_profiles: "identified_only" });
const track = (event, props) => { if (PH_KEY) posthog.capture(event, props); };

// ─── DISCORD WEBHOOK ─────────────────────────────────────────────────────────
const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1477427861706117265/mewcLc9XgpBYM10AiQQl3lpY016KvrmI1sc897YD2yYQJL78TTqVu73lbDrsHbrgwK5i";

async function upsertProfile(userData) {
  const quadrant = userData.selfPosition ? getQuadrant(userData.selfPosition.x, userData.selfPosition.y) : null;
  const quadrantLabel = quadrant ? QUADRANT_READS[quadrant]?.title : null;
  const ref = localStorage.getItem("cove_ref") || null;
  const { data, error } = await supabase.from("profiles").upsert({
    name: userData.name || null,
    email: userData.email || null,
    quadrant: quadrantLabel,
    x: userData.selfPosition?.x ?? null,
    y: userData.selfPosition?.y ?? null,
    brave_reflection: userData.braveReflection || null,
    fears_reflection: userData.fearsReflection || null,
    contacts: userData.contacts || [],
    ref,
    updated_at: new Date().toISOString(),
  }, { onConflict: "email", ignoreDuplicates: false });
  if (data?.[0]?.id) localStorage.setItem("cove_profile_id", data[0].id);
  return { data, error };
}

function postReflections({ name, email, selfPosition, braveReflection, fearsReflection, wants = [] }) {
  const quadrant = selfPosition ? getQuadrant(selfPosition.x, selfPosition.y) : null;
  const quadrantLabel = quadrant ? QUADRANT_READS[quadrant]?.title : "Unknown";
  const wantsSummary = wants.filter(w => w.feeling).map(w => `${w.feeling}: ${w.text}`).join("\n") || "_(none tagged)_";
  const ref = localStorage.getItem("cove_ref") || null;

  // Save to Supabase
  supabase.from("reflections").insert({
    name: name || null,
    phone: email || null,
    ref: ref,
    quadrant: quadrantLabel,
    brave_reflection: braveReflection || null,
    fears_reflection: fearsReflection || null,
  }).then(() => {}); // fire and forget

  // Also ping Discord
  fetch(DISCORD_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Cove",
      embeds: [{
        title: `New reflection — ${name || "Anonymous"}`,
        color: 0x4a9eca,
        fields: [
          { name: "📍 Matrix placement", value: quadrantLabel, inline: true },
          { name: "📧 Email", value: email || "_(not provided)_", inline: true },
          { name: "🔗 Ref", value: ref || "_(direct)_", inline: true },
          { name: "💙 Brave decision", value: braveReflection || "_(no response)_" },
          { name: "🌊 What's in the way", value: fearsReflection || "_(no response)_" },
          { name: "✨ What they want", value: wantsSummary },
        ],
        footer: { text: `cove · ${TAGLINE}` },
        timestamp: new Date().toISOString(),
      }],
    }),
  }).catch(() => {}); // fire and forget — don't block the user
}

// ─── TAGLINE A/B ─────────────────────────────────────────────────────────────
// "A" = original  |  "B" = matrix hook  ← change one letter to switch
const TAGLINE_VERSION = "A";
const TAGLINE = TAGLINE_VERSION === "A"
  ? "your career. your current."
  : "where do you land on the matrix?";

// ─── PALETTE ────────────────────────────────────────────────────────────────
const C = {
  bg:         "#0b0f14",
  surface:    "#0f1520",
  raised:     "#131c28",
  border:     "#1a2535",
  borderSoft: "#141e2c",
  text:       "#ddeef8",
  muted:      "#a8c4d4",
  faint:      "#1e2d40",
  dim:        "#8aafc4",
  ocean:      "#4a9eca",
  oceanDeep:  "#2a6a9a",
  seafoam:    "#5ec4b0",
  sky:        "#7ab8d8",
  mist:       "#9cb8cc",
  tide:       "#3d7fa8",
  pearl:      "#ccdde8",
};

// ─── FEELING DEFINITIONS ─────────────────────────────────────────────────────
const FEELINGS = [
  { id: "Freedom",     color: "#4a9eca", desc: "Autonomy over when, where, and how you work" },
  { id: "Stability",   color: "#9cb8cc", desc: "A financial floor you can actually build from" },
  { id: "Growth",      color: "#6dbb8a", desc: "Getting better at something that matters to you" },
  { id: "Purpose",     color: "#c4a040", desc: "Work that means something beyond the paycheck" },
  { id: "Belonging",   color: "#a87ac4", desc: "A team and culture where you genuinely fit" },
  { id: "Impact",      color: "#e07868", desc: "Changing something real in the world or in people" },
  { id: "Creativity",  color: "#e0a060", desc: "Making things, solving things, expressing things" },
  { id: "Legacy",      color: "#5ec4b0", desc: "Meaning that outlasts the role" },
  { id: "Joy",         color: "#b8ccd8", desc: "People and work that genuinely light something up" },
  { id: "Curiosity",   color: "#7ab8d8", desc: "Problems worth losing yourself in" },
  { id: "Recognition", color: "#d4986a", desc: "Being seen and acknowledged for what you bring" },
  { id: "Access",      color: "#3d7fa8", desc: "A seat where real decisions get made" },
];

const SEED_WANTS = [
  "Travel on my own terms",
  "Work from wherever",
  "Leave something lasting",
  "Work on hard problems",
  "Earn enough to breathe easy",
  "Be around people I admire",
  "Have a voice in the room",
  "Build things that get used",
];

// ─── DEPTH PALETTE ───────────────────────────────────────────────────────────
// As the user moves through onboarding (steps 0–17), the water clears.
// Deep/murky → mid-depth → clearing → surface light.
function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function lerpHex(c1, c2, t) {
  const p = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
  const [r1,g1,b1] = p(c1); const [r2,g2,b2] = p(c2);
  return `#${[lerp(r1,r2,t),lerp(g1,g2,t),lerp(b1,b2,t)].map(v=>v.toString(16).padStart(2,"0")).join("")}`;
}

const DEPTH_STOPS = [
  { bg: "#06080c", text: "#8aaabf", accent: "#1e4a6a" },   // 0  — abyss
  { bg: "#080c14", text: "#96b4c8", accent: "#2a5c80" },   // 6  — deep
  { bg: "#0c1620", text: "#a8c8dc", accent: "#3a7aaa" },   // 11 — mid
  { bg: "#0f1e30", text: "#d4ecf8", accent: "#6ab8e8" },   // 17 — surface
];

function getDepthPalette(step) {
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

// ─── FADE-IN HOOK ─────────────────────────────────────────────────────────────
function useFadeIn(deps = []) {
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

// ─── ROOT ────────────────────────────────────────────────────────────────────
const DEFAULT_USER_DATA = {
  name: "",
  email: "",
  phone: "",
  selfPosition: null,
  braveReflection: "",
  fearsReflection: "",
  wants: [],
  contacts: [],
};

export default function App() {
  const isCoach = typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("coach") === "true";
  if (isCoach) return <CoachDashboard />;
  return <AppInner />;
}

function AppInner() {
  const [phase, setPhase] = useState(() =>
    localStorage.getItem("cove_phase") || "onboard"
  );
  const [onboardStep, setStep] = useState(() =>
    parseInt(localStorage.getItem("cove_step") || "0")
  );
  const [userData, setUserData] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cove_userData")) || DEFAULT_USER_DATA; }
    catch { return DEFAULT_USER_DATA; }
  });
  const [mainTab, setMainTab]   = useState("home");
  const [activeContact, setActiveContact] = useState(null);

  const update = (patch) => setUserData(d => ({ ...d, ...patch }));

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) localStorage.setItem("cove_ref", ref);
  }, []);

  useEffect(() => { localStorage.setItem("cove_phase", phase); }, [phase]);
  useEffect(() => { localStorage.setItem("cove_step", String(onboardStep)); }, [onboardStep]);
  useEffect(() => { localStorage.setItem("cove_userData", JSON.stringify(userData)); }, [userData]);

  if (phase === "onboard") {
    return (
      <Onboard
        step={onboardStep}
        setStep={setStep}
        userData={userData}
        update={update}
        finish={() => { upsertProfile(userData); setPhase("main"); }}
      />
    );
  }

  const resetAll = () => {
    localStorage.removeItem("cove_phase");
    localStorage.removeItem("cove_step");
    localStorage.removeItem("cove_userData");
    setPhase("onboard");
    setStep(0);
    setUserData(DEFAULT_USER_DATA);
    setMainTab("home");
  };

  return (
    <MainApp
      userData={userData}
      update={update}
      tab={mainTab}
      setTab={setMainTab}
      activeContact={activeContact}
      setActiveContact={setActiveContact}
      onReset={resetAll}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONBOARDING
// ═══════════════════════════════════════════════════════════════════════════════

function Onboard({ step, setStep, userData, update, finish }) {
  const go = (nextStep, event, props = {}) => {
    track(event, { step: nextStep, ...props });
    setStep(nextStep);
  };

  const steps = [
    <StepWelcome        key={0} next={() => { track("onboarding_started"); go(1, "step_completed", { step_name: "welcome" }); }} />,
    <StepWhyCove        key={1} next={() => go(2, "step_completed", { step_name: "why_cove" })} />,
    <StepSlowDown       key={2} next={() => go(3, "step_completed", { step_name: "slow_down" })} />,
    <StepPrivacy        key={3} next={() => go(4, "step_completed", { step_name: "privacy" })} />,
    <StepPhilosophy     key={4} next={() => go(5, "step_completed", { step_name: "philosophy" })} />,
    <StepName           key={5} next={(name) => { update({ name }); if (PH_KEY) posthog.identify(name); go(6, "step_completed", { step_name: "name" }); }} />,
    <StepMatrixIntro    key={6} name={userData.name} next={() => go(7, "step_completed", { step_name: "matrix_intro" })} />,
    <StepSelfMatrix     key={7} name={userData.name} initialPosition={userData.selfPosition} next={(selfPosition) => {
      update({ selfPosition });
      const q = getQuadrant(selfPosition.x, selfPosition.y);
      const quadrantLabel = QUADRANT_READS[q]?.title || q;
      supabase.from("matrix_sessions").insert({
        name: userData.name || null,
        x: selfPosition.x, y: selfPosition.y,
        quadrant: quadrantLabel,
        ref: localStorage.getItem("cove_ref") || null,
      }).then(() => {});
      track("matrix_placed", { quadrant: quadrantLabel, x: selfPosition.x, y: selfPosition.y });
      go(8, "step_completed", { step_name: "matrix" });
    }} />,
    <StepQuadrantReveal key={8} selfPosition={userData.selfPosition} next={() => go(9, "step_completed", { step_name: "quadrant_reveal" })} />,
    <StepQuadrantRead   key={9} selfPosition={userData.selfPosition} next={() => go(10, "step_completed", { step_name: "quadrant_read" })} />,
    <StepMatrixPause    key={10} selfPosition={userData.selfPosition} next={() => go(11, "step_completed", { step_name: "matrix_pause" })} goBack={() => setStep(7)} />,
    <StepAshStory       key={11} next={() => go(12, "step_completed", { step_name: "ash_story" })} />,
    <StepBraveReflect   key={12} next={(braveReflection) => { update({ braveReflection }); go(13, "step_completed", { step_name: "brave_reflect" }); }} />,
    <StepFearsReflect   key={13} next={(fearsReflection) => {
      update({ fearsReflection });
      postReflections({ ...userData, fearsReflection });
      track("reflection_submitted", { has_brave: !!userData.braveReflection, has_fears: !!fearsReflection });
      go(14, "step_completed", { step_name: "fears_reflect" });
    }} />,
    <StepPause          key={14} next={() => go(15, "step_completed", { step_name: "pause" })} />,
    <StepCareersOverCash key={15} next={() => go(16, "step_completed", { step_name: "careers_over_cash" })} />,
    <StepListDialogue   key={16} name={userData.name} next={() => go(17, "step_completed", { step_name: "list_dialogue" })} />,
    <StepWarmCold       key={17} next={() => go(18, "step_completed", { step_name: "warm_cold" })} />,
    <StepListBuilder    key={18} contacts={userData.contacts} update={update} next={(contacts) => {
      update({ contacts });
      track("list_built", { list_count: contacts.length });
      go(19, "step_completed", { step_name: "list_built" });
    }} />,
    <StepListReveal     key={19} contacts={userData.contacts} name={userData.name} next={() => go(20, "step_completed", { step_name: "list_reveal" })} />,
    <StepBreath         key={20} name={userData.name} contacts={userData.contacts} selfPosition={userData.selfPosition} next={() => go(21, "step_completed", { step_name: "breath" })} />,
    <StepFounderNote    key={21} next={() => go(22, "step_completed", { step_name: "founder_note" })} />,
    <StepBetaForm       key={22} name={userData.name} selfPosition={userData.selfPosition} contacts={userData.contacts} finish={() => { track("onboarding_completed"); finish(); }} />,
  ];

  // Dots: philosophy(4), name(5), matrix intro(6), matrix(7), brave(12), fears(13), list(16-22)
  const dotMap = { 4:1, 5:2, 6:3, 7:3, 12:4, 13:4, 16:5, 17:5, 18:5, 19:5, 20:5, 21:5, 22:5 };
  const showDots = step in dotMap;
  const dotStep = dotMap[step] || 0;

  return (
    <Shell depth={step}>
      {/* Back button */}
      {step > 0 && (
        <div
          onClick={() => setStep(Math.max(0, step - 1))}
          style={{
            position: "absolute", top: 16, left: 18, zIndex: 20,
            fontSize: 22, color: C.muted, cursor: "pointer",
            padding: "6px 10px", borderRadius: 8,
            lineHeight: 1,
          }}
        >‹</div>
      )}
      {showDots && (
        <div style={{
          display: "flex", justifyContent: "center", gap: 6,
          padding: "16px 0 0",
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
        }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{
              width: i <= dotStep ? 18 : 6, height: 6, borderRadius: 3,
              background: i <= dotStep ? C.ocean : C.faint,
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>
      )}
      {steps[step]}
    </Shell>
  );
}

// ── Step 0: Welcome ───────────────────────────────────────────────────────────
function StepWelcome({ next }) {
  const visible = useFadeIn([]);
  return (
    <div style={{ ...fadeStyle(visible), display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", minHeight:"100vh", padding:"48px 32px", textAlign:"center" }}>
      <div style={{ marginBottom: 52 }}>
        <div style={{ fontSize: 11, letterSpacing: 8, color: C.sky, fontFamily: "monospace", marginBottom: 32, opacity: 0.7 }}>
          C O V E
        </div>
        <h1 style={{ fontSize: 38, fontWeight: 400, margin: "0 0 22px", color: "#e8f2fa", lineHeight: 1.25, letterSpacing: -1 }}>
          Find work that<br />actually fits.
        </h1>
        <p style={{ fontSize: 15, color: C.mist, lineHeight: 1.9, margin: "0 0 28px", maxWidth: 300 }}>
          Not a job board. Not a resume builder.<br />A simple, proven system to build the career you actually want.
        </p>
        <p style={{ fontSize: 12, letterSpacing: 4, color: C.ocean, fontFamily: "monospace", margin: "0 0 10px", textTransform: "lowercase", opacity: 0.85 }}>
          {TAGLINE}
        </p>
      </div>

      <div style={{ width: "100%", maxWidth: 320 }}>
        <Btn onClick={next}>Begin</Btn>
      </div>

      <p style={{ fontSize: 12, color: C.muted, marginTop: 28, fontStyle: "italic", letterSpacing: 0.3 }}>
        takes about 5 minutes
      </p>
    </div>
  );
}

// ── Step 1: Why Cove ──────────────────────────────────────────────────────────
function StepWhyCove({ next }) {
  const visible = useFadeIn([]);
  return (
    <div style={{ ...fadeStyle(visible), padding: "64px 28px 48px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 10, letterSpacing: 3, color: C.sky, fontFamily: "monospace", margin: "0 0 20px", opacity: 0.7 }}>WHY THIS EXISTS</p>

        <h2 style={{ fontSize: 28, fontWeight: 400, margin: "0 0 14px", color: "#e8f2fa", lineHeight: 1.3 }}>
          The job search is broken.
        </h2>
        <p style={{ fontSize: 15, color: C.mist, lineHeight: 1.85, margin: "0 0 28px" }}>
          Cold applications. Ghosted inboxes. Nobody telling you the truth. Cove is built to change that.
        </p>

        {/* Stats */}
        <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
          {[
            { stat: "40×", label: "warm vs. cold outreach" },
            { stat: "85%", label: "jobs filled via network" },
          ].map(({ stat, label }) => (
            <div key={stat} style={{ flex: 1, padding: "18px 16px", borderRadius: 14, background: C.surface, border: `1px solid ${C.borderSoft}`, textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 300, color: C.ocean, letterSpacing: -1, marginBottom: 6 }}>{stat}</div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, letterSpacing: 0.3 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Three moves */}
        <p style={{ fontSize: 11, letterSpacing: 3, color: C.muted, fontFamily: "monospace", margin: "0 0 14px" }}>HOW IT WORKS</p>
        {[
          { n: "01", title: "Know yourself", body: "The Bravery / Curiosity Matrix — a simple framework to see where you actually are, not where you wish you were." },
          { n: "02", title: "Build the list", body: "Your List of 100. The people already in your corner who can open real doors." },
          { n: "03", title: "Talk it out", body: "Get honest about what's in the way. That's the whole move." },
        ].map(({ n, title, body }) => (
          <div key={n} style={{ display: "flex", gap: 14, marginBottom: 16, padding: "16px 18px", borderRadius: 14, background: C.surface, border: `1px solid ${C.borderSoft}` }}>
            <div style={{ fontSize: 11, color: C.ocean, fontFamily: "monospace", fontWeight: 600, paddingTop: 2, flexShrink: 0 }}>{n}</div>
            <div>
              <div style={{ fontSize: 14, color: C.pearl, marginBottom: 5, fontWeight: 500 }}>{title}</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>{body}</div>
            </div>
          </div>
        ))}

        {/* Open source */}
        <div style={{ marginTop: 24, padding: "18px 20px", borderRadius: 14, background: C.faint, border: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 13, color: C.muted, margin: "0 0 10px", lineHeight: 1.7 }}>
            Cove is open-source. No company. No profit motive. Built by someone who went through it and wanted something better.
          </p>
          <a
            href="https://github.com/chieffhiwa/cove"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: C.ocean, textDecoration: "none", fontFamily: "monospace", letterSpacing: 0.5, display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            ↗ github.com/chieffhiwa/cove
          </a>
        </div>
      </div>

      <Btn onClick={next} style={{ marginTop: 32 }}>got it. let's go.</Btn>
    </div>
  );
}

// ── Step 2: Slow Down ─────────────────────────────────────────────────────────
function StepSlowDown({ next }) {
  const visible = useFadeIn([]);
  return (
    <div style={{ ...fadeStyle(visible), display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", padding: "48px 32px", textAlign: "center" }}>
      <div style={{ marginBottom: 48, maxWidth: 300 }}>
        <div style={{ fontSize: 36, marginBottom: 28 }}>🌊</div>
        <h2 style={{ fontSize: 30, fontWeight: 400, margin: "0 0 20px", color: "#e8f2fa", lineHeight: 1.3, letterSpacing: -0.5 }}>
          This takes a couple minutes.
        </h2>
        <p style={{ fontSize: 16, color: C.mist, lineHeight: 1.9, margin: "0 0 20px" }}>
          Not a survey. Not a quiz.<br />
          A moment to actually slow down.
        </p>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.85, margin: 0 }}>
          If you're in a rush, close the tab and come back when you have a few minutes to yourself. It's worth it.
        </p>
      </div>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <Btn onClick={next}>I'm ready</Btn>
      </div>
      <p style={{ fontSize: 12, color: C.dim, marginTop: 20, fontStyle: "italic" }}>
        the whole thing is about slowing down
      </p>
    </div>
  );
}

// ── Step 3: Privacy ───────────────────────────────────────────────────────────
function StepPrivacy({ next }) {
  const visible = useFadeIn([]);
  const commitments = [
    { icon: "🔒", title: "Your data stays yours", body: "Your reflections stay with you. We don't sell them, share them, or use them for anything else." },
    { icon: "👁️", title: "No surveillance", body: "We're not an ad business. We're a career tool." },
    { icon: "💙", title: "A personal commitment", body: "This works for you, or it doesn't work. Tell us if we break that trust." },
    { icon: "⚖️", title: "We build against bias", body: "Built to surface your strengths — not sort you into a box. Something feels off? Say so." },
  ];

  return (
    <div style={{ ...fadeStyle(visible), padding: "72px 28px 48px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 10, letterSpacing: 3, color: C.sky, fontFamily: "monospace", margin: "0 0 18px", opacity: 0.7 }}>BEFORE WE START</p>
        <h2 style={{ fontSize: 28, fontWeight: 400, margin: "0 0 12px", color: "#e8f2fa", lineHeight: 1.3 }}>
          We don't touch your data.
        </h2>
        <p style={{ fontSize: 14, color: C.mist, lineHeight: 1.85, margin: "0 0 28px" }}>
          Your reflections are personal. We treat them that way.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {commitments.map((c, i) => (
            <div key={i} style={{
              padding: "18px 20px", borderRadius: 14,
              background: C.surface, border: `1px solid ${C.borderSoft}`,
              display: "flex", gap: 14, alignItems: "flex-start",
            }}>
              <span style={{ fontSize: 20, lineHeight: 1, marginTop: 2 }}>{c.icon}</span>
              <div>
                <div style={{ fontSize: 13, color: "#d8ecf8", fontWeight: 500, marginBottom: 6 }}>{c.title}</div>
                <div style={{ fontSize: 13, color: C.mist, lineHeight: 1.8 }}>{c.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Btn onClick={next} style={{ marginTop: 32 }}>got it! let's go.</Btn>
    </div>
  );
}

// ── Step 2: Pricing ───────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
function StepPricing({ next }) {
  const visible = useFadeIn([]);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleStart = async () => {
    const trimmed = email.trim();
    if (!trimmed) { next(""); return; }
    if (!/\S+@\S+\.\S+/.test(trimmed)) { setError("enter a valid email"); return; }
    setError("");
    setLoading(true);
    const { error: sbError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (sbError) { setError("something went wrong, try again"); return; }
    setSent(true);
    setTimeout(() => next(trimmed), 2500);
  };

  return (
    <div style={{ ...fadeStyle(visible), display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", padding: "48px 28px", textAlign: "center" }}>

      <div style={{ marginBottom: 44, maxWidth: 320 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontFamily: "monospace", margin: "0 0 24px" }}>MEMBERSHIP</p>
        <div style={{ fontSize: 52, fontWeight: 300, color: C.pearl, letterSpacing: -2, marginBottom: 6 }}>$5</div>
        <div style={{ fontSize: 14, color: C.muted, marginBottom: 28 }}>per month</div>

        <div style={{ padding: "20px", borderRadius: 12, marginBottom: 24, background: C.surface, border: `1px solid ${C.borderSoft}`, textAlign: "left" }}>
          {[
            "Less than a Guinness.",
            "Cancel anytime, no questions.",
            "Not for you? Full refund.",
            "We think you'll like it.",
          ].map((line, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: i < 3 ? 12 : 0 }}>
              <span style={{ color: C.ocean, fontSize: 14, lineHeight: 1.5, flexShrink: 0 }}>·</span>
              <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{line}</span>
            </div>
          ))}
        </div>

        {sent ? (
          <div style={{ padding: "16px 20px", borderRadius: 12, background: C.faint, border: `1px solid ${C.ocean}`, textAlign: "left" }}>
            <p style={{ fontSize: 13, color: C.ocean, margin: 0, lineHeight: 1.6 }}>
              ✓ Check your inbox. We sent you a link.
            </p>
          </div>
        ) : (
          <>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleStart()}
              style={{
                width: "100%", padding: "14px 16px", borderRadius: 10, marginBottom: 8,
                background: C.surface, border: `1px solid ${error ? "#e05c5c" : C.border}`,
                color: C.text, fontSize: 15, outline: "none", textAlign: "left",
                fontFamily: "inherit", boxSizing: "border-box",
              }}
            />
            {error && <p style={{ fontSize: 12, color: "#e05c5c", margin: "0 0 8px", textAlign: "left" }}>{error}</p>}
            <p style={{ fontSize: 11, color: C.dim, lineHeight: 1.7, margin: "0 0 20px", fontStyle: "italic", textAlign: "left" }}>
              No payment now. We'll handle that together.
            </p>
          </>
        )}
      </div>

      {!sent && (
        <div style={{ width: "100%", maxWidth: 320 }}>
          <Btn onClick={handleStart} disabled={loading}>
            {loading ? "sending…" : "Start my trial"}
          </Btn>
        </div>
      )}
    </div>
  );
}

// ── Step 3: Philosophy ── (was Step 1) ───────────────────────────────────────
function StepPhilosophy({ next }) {
  const visible = useFadeIn([]);
  const principles = [
    { icon: "💙", title: "\u201cGo-Giver\u201d first", body: "Give before you ask. Show up with something to offer.", cite: "The Go-Giver — Bob Burg & John David Mann" },
    { icon: "〰️", title: "Careers over cash", body: "That opportunity you keep coming back to? The one that feels like it matters? That's the one.", cite: "Cal Newport, So Good They Can't Ignore You" },
    { icon: "🐸", title: "Generous enthusiasm", body: "When you know what you have to offer, the energy shifts. You stop performing and start connecting.", cite: "Ash Ketchum — \"Do you always need a reason to help somebody?\"" },
  ];

  return (
    <div style={{ ...fadeStyle(visible), padding: "72px 28px 48px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontFamily: "monospace", marginBottom: 20 }}>HOW THIS WORKS</p>
        <h2 style={{ fontSize: 26, fontWeight: 400, margin: "0 0 32px", color: C.pearl, lineHeight: 1.35 }}>
          Three key principles.
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {principles.map((p, i) => (
            <div key={i} style={{
              padding: "18px 20px", borderRadius: 12,
              background: C.surface, border: `1px solid ${C.borderSoft}`,
              display: "flex", gap: 16, alignItems: "flex-start",
            }}>
              <span style={{ fontSize: 22, lineHeight: 1, marginTop: 2 }}>{p.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.pearl, marginBottom: 5 }}>{p.title}</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>{p.body}</div>
                {p.cite && (
                  <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic", marginTop: 10, opacity: 0.7, letterSpacing: 0.2 }}>— {p.cite}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Btn onClick={next} style={{ marginTop: 32 }}>I can get with that 🙂‍↕️</Btn>
    </div>
  );
}

// ── Step 2: Name ──────────────────────────────────────────────────────────────
function StepName({ next }) {
  const visible = useFadeIn([]);
  const [name, setName] = useState("");
  return (
    <div style={{ ...fadeStyle(visible), padding: "72px 28px 48px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontFamily: "monospace", marginBottom: 20 }}>FIRST THINGS</p>
        <h2 style={{ fontSize: 26, fontWeight: 400, margin: "0 0 10px", color: C.pearl, lineHeight: 1.35 }}>
          What do people call you?
        </h2>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, margin: "0 0 36px" }}>
          Private. Just makes this feel like yours.
        </p>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && name.trim() && next(name.trim())}
          placeholder="your name"
          style={{
            width: "100%", background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: "16px 18px", fontSize: 18,
            color: C.pearl, outline: "none", fontFamily: "Georgia, serif",
            boxSizing: "border-box",
            borderColor: name ? C.ocean : C.border,
            transition: "border-color 0.2s",
          }}
        />
      </div>
      <Btn onClick={() => name.trim() && next(name.trim())} disabled={!name.trim()}>
        Continue
      </Btn>
    </div>
  );
}

// ── Step 4: Email ─────────────────────────────────────────────────────────────
function StepEmail({ next }) {
  const visible = useFadeIn([]);
  const [email, setEmail] = useState("");

  const sources = [
    { icon: "🎓", label: "coaches" },
    { icon: "🏛️", label: "professors" },
    { icon: "💼", label: "hiring managers" },
    { icon: "🤝", label: "peers" },
  ];

  return (
    <div style={{ ...fadeStyle(visible), padding: "72px 28px 48px", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <p style={{ fontSize: 11, letterSpacing: 2, color: C.ocean, fontFamily: "monospace", margin: "0 0 20px" }}>WE KNOW SOME PEOPLE</p>
      <h2 style={{ fontSize: 30, fontWeight: 300, color: C.pearl, lineHeight: 1.4, margin: "0 0 16px" }}>
        Real content.<br />From real people.
      </h2>
      <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, margin: "0 0 22px" }}>
        Once in a while, we'll send you something actually worth reading — curated from the people who've been where you're trying to go.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "0 0 28px" }}>
        {sources.map(s => (
          <div key={s.label} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "4px 0",
          }}>
            <span style={{ fontSize: 16 }}>{s.icon}</span>
            <span style={{ fontSize: 13, color: C.mist, letterSpacing: 0.2 }}>{s.label}</span>
          </div>
        ))}
      </div>

      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        onKeyDown={e => e.key === "Enter" && next(email.trim())}
        placeholder="your@email.com"
        autoFocus
        style={{
          width: "100%", background: C.surface, border: `1px solid ${email ? C.ocean : C.border}`,
          borderRadius: 12, padding: "15px 18px", fontSize: 16, color: C.text,
          outline: "none", fontFamily: "Georgia, serif", boxSizing: "border-box",
          letterSpacing: 0.5, transition: "border-color 0.2s",
        }}
      />
      <p style={{ fontSize: 11, color: C.dim, margin: "10px 0 28px", letterSpacing: 0.2 }}>
        No spam. Ever. Just stuff worth reading.
      </p>

      <Btn onClick={() => next(email.trim())}>
        {email.trim() ? "send it my way →" : "skip for now →"}
      </Btn>
    </div>
  );
}

// ── Step 5: Matrix Intro ──────────────────────────────────────────────────────
function StepMatrixIntro({ name, next }) {
  const visible = useFadeIn([]);
  return (
    <div style={{ ...fadeStyle(visible), padding: "72px 28px 48px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontFamily: "monospace", margin: "0 0 20px" }}>THE MATRIX</p>
        <h2 style={{ fontSize: 26, fontWeight: 400, margin: "0 0 16px", color: C.pearl, lineHeight: 1.4 }}>
          Where are you sitting right now{name ? `, ${name}` : ""}?
        </h2>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.8, margin: "0 0 32px" }}>
          Not who you want to be — where you actually are today. You'll place a dot on a two-axis grid. Takes about ten seconds.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
          <div style={{ padding: "14px 18px", borderRadius: 12, background: C.surface, border: `1px solid ${C.borderSoft}` }}>
            <div style={{ fontSize: 12, color: C.seafoam, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>BRAVE ↕ FEARFUL</div>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: 0 }}>
              Are you making moves right now — or holding back?
            </p>
          </div>
          <div style={{ padding: "14px 18px", borderRadius: 12, background: C.surface, border: `1px solid ${C.borderSoft}` }}>
            <div style={{ fontSize: 12, color: C.ocean, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>CURIOUS ↔ JUDGMENTAL</div>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: 0 }}>
              Still exploring options — or already decided what's possible?
            </p>
          </div>
        </div>

        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: "0 0 16px", fontStyle: "italic" }}>
          Not a personality type. A snapshot of right now.
        </p>

        {/* Stuart attribution */}
        <div style={{ padding: "14px 18px", borderRadius: 12, background: C.surface, border: `1px solid ${C.borderSoft}`, display: "flex", alignItems: "center", gap: 14 }}>
          <img
            src="/stuart.jpg"
            alt="Stuart Hillston"
            style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
          <div>
            <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, margin: "0 0 3px" }}>
              Framework by{" "}
              <a href="https://www.linkedin.com/in/stuarthillston/" target="_blank" rel="noopener noreferrer" style={{ color: C.ocean, textDecoration: "none" }}>Stuart Hillston</a>
            </p>
            <p style={{ fontSize: 11, color: C.dim, margin: "0 0 4px", fontStyle: "italic", lineHeight: 1.5 }}>
              "Psychotherapeutic Coach to Managers and Leaders in Startups and Scaleups."
            </p>
            <p style={{ fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.5 }}>
              Spectacular coach, and an even better friend.
            </p>
          </div>
        </div>
      </div>

      <Btn onClick={next} style={{ marginTop: 32 }}>Place yourself →</Btn>
    </div>
  );
}

// ── Step 3: Self Matrix ───────────────────────────────────────────────────────

// Landscape images per quadrant — rotates by day+hour for freshness
const QUADRANT_IMAGES = {
  "brave-curious": [
    "https://source.unsplash.com/featured/900x400/?ocean,dawn,horizon",
    "https://source.unsplash.com/featured/900x400/?open,sea,sunrise,sailing",
    "https://source.unsplash.com/featured/900x400/?coastline,wave,morning,light",
    "https://source.unsplash.com/featured/900x400/?adventure,wide,sky,open",
  ],
  "brave-judgmental": [
    "https://source.unsplash.com/featured/900x400/?mountain,peak,clear,sky",
    "https://source.unsplash.com/featured/900x400/?summit,alpine,sharp,ridge",
    "https://source.unsplash.com/featured/900x400/?cliff,bold,height,blue",
    "https://source.unsplash.com/featured/900x400/?glacier,crisp,vast,ice",
  ],
  "fearful-curious": [
    "https://source.unsplash.com/featured/900x400/?forest,light,depth,trees",
    "https://source.unsplash.com/featured/900x400/?underwater,blue,deep,ocean",
    "https://source.unsplash.com/featured/900x400/?jungle,green,quiet,canopy",
    "https://source.unsplash.com/featured/900x400/?cave,light,dark,explore",
  ],
  "fearful-judgmental": [
    "https://source.unsplash.com/featured/900x400/?fog,mist,morning,path",
    "https://source.unsplash.com/featured/900x400/?still,lake,reflection,calm",
    "https://source.unsplash.com/featured/900x400/?winter,quiet,snow,soft",
    "https://source.unsplash.com/featured/900x400/?mist,valley,gentle,earth",
  ],
};

function getQuadrantImage(quadrant) {
  const arr = QUADRANT_IMAGES[quadrant] || QUADRANT_IMAGES["brave-curious"];
  return arr[(new Date().getDate() + new Date().getHours()) % arr.length];
}

const QUADRANT_READS = {
  "brave-curious": {
    title: "Brave + Curious",
    color: "#5ec4b0",
    short: "You move fast and ask hard questions.",
    read: "You belong in environments that haven't figured everything out yet and don't pretend to. Startups, innovation teams, roles where the playbook is still being written. Places that reward people who say 'what if we tried this?' out loud. Avoid anywhere that confuses confidence with certainty.",
    jobs: ["Product", "Strategy", "Founding roles", "Innovation", "Research"],
  },
  "brave-judgmental": {
    title: "Brave + Judgmental",
    color: "#7ab8d8",
    short: "Strong convictions. You act on them.",
    read: "You know what good looks like and you have the courage to hold the line. You thrive where there's a standard to uphold ops, legal, finance, senior leadership. Places that need someone who won't fold under pressure. Watch out for environments that mistake rigidity for rigor.",
    jobs: ["Operations", "Leadership", "Policy", "Legal", "Editorial"],
  },
  "fearful-curious": {
    title: "Fearful + Curious",
    color: "#4a9eca",
    short: "You process deeply before you move.",
    read: "You're thoughtful in a way that looks like hesitation from the outside but it's not. You do your best work when you have strong mentorship, clear context, and enough psychological safety to experiment without performing confidence you don't have yet. Look for cultures that value depth over speed.",
    jobs: ["Research", "Design", "Writing", "Analysis", "Education"],
  },
  "fearful-judgmental": {
    title: "In a cautious place right now.",
    color: "#9cb8cc",
    short: "That's okay. Most people are.",
    read: "Something's made you careful. That's not a character flaw it's data. Before you optimize for the right role, find one person: a mentor, a sponsor, someone who's seen you at your best and will say so. The right environment will follow. Cove is a good place to map who that person might be.",
    jobs: ["Find a mentor first", "Low-stakes experiments", "Internal moves"],
  },
};

function getQuadrant(x, y) {
  const brave = y < 50;
  const curious = x > 50;
  if (brave && curious)   return "brave-curious";
  if (brave && !curious)  return "brave-judgmental";
  if (!brave && curious)  return "fearful-curious";
  return "fearful-judgmental";
}

function StepSelfMatrix({ name, initialPosition, next }) {
  const visible = useFadeIn([]);
  const [pos, setPos] = useState(initialPosition || null);
  const [confirmed, setConfirmed] = useState(false);
  const isReturn = !!initialPosition;
  const gridRef = useRef(null);

  const handleTap = (e) => {
    if (confirmed) return;
    const rect = gridRef.current.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    const x = Math.round(((touch.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((touch.clientY - rect.top) / rect.height) * 100);
    setPos({ x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) });
    setConfirmed(false);
  };

  const quadrantKey = pos ? getQuadrant(pos.x, pos.y) : null;
  const read = quadrantKey ? QUADRANT_READS[quadrantKey] : null;

  return (
    <div style={{ ...fadeStyle(visible), padding: "72px 28px 48px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div>
        <p style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontFamily: "monospace", margin: "0 0 16px" }}>THE MATRIX</p>
        {isReturn ? (
          <>
            <h2 style={{ fontSize: 24, fontWeight: 400, margin: "0 0 8px", color: C.pearl, lineHeight: 1.35 }}>
              Not feeling it?
            </h2>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: "0 0 22px" }}>
              Move your dot. This is about how you actually see yourself right now. Not how you want to be seen, not who you're becoming. Just honest. Where are you today?
            </p>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 24, fontWeight: 400, margin: "0 0 8px", color: C.pearl, lineHeight: 1.35 }}>
              Be real with yourself, {name}.
            </h2>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: "0 0 22px" }}>
              Brave or fearful? Curious or judgmental? Be honest, not aspirational. Where you actually are, not where you want to be.
            </p>
          </>
        )}
      </div>

      {/* Grid */}
      <div
        ref={gridRef}
        onClick={handleTap}
        onTouchStart={handleTap}
        style={{
          position: "relative", background: C.surface,
          border: `1px solid ${C.border}`, borderRadius: 14,
          aspectRatio: "1/1", width: "100%",
          cursor: "crosshair", touchAction: "none",
          overflow: "hidden", flexShrink: 0,
        }}
      >
        {/* Axis lines */}
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: C.border }} />
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: C.border }} />

        {/* Quadrant tints */}
        <div style={{ position: "absolute", top: 0, left: "50%", right: 0, bottom: "50%", background: C.seafoam+"06" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", right: 0, bottom: 0, background: C.ocean+"05" }} />

        {/* Axis labels */}
        {[
          { text: "BRAVE",      style: { top: 10,    left: "50%", transform: "translateX(-50%)", color: C.seafoam } },
          { text: "FEARFUL",    style: { bottom: 10, left: "50%", transform: "translateX(-50%)", color: C.muted } },
          { text: "CURIOUS",    style: { right: 8,   top: "50%",  transform: "translateY(-50%)", color: C.ocean } },
          { text: "JUDGMENTAL", style: { left: 6,    top: "50%",  transform: "translateY(-50%) rotate(180deg)", color: C.muted, writingMode: "vertical-rl" } },
        ].map((l, i) => (
          <div key={i} style={{ position: "absolute", fontSize: 7, fontFamily: "monospace", letterSpacing: 2, fontWeight: 700, pointerEvents: "none", ...l.style }}>{l.text}</div>
        ))}

        {/* Quadrant whispers */}
        <div style={{ position: "absolute", top: 24, right: 18, fontSize: 8, color: C.seafoam+"40", fontFamily: "monospace", pointerEvents: "none" }}>fast movers</div>
        <div style={{ position: "absolute", top: 24, left: 18, fontSize: 8, color: C.muted+"30", fontFamily: "monospace", pointerEvents: "none" }}>hold the line</div>
        <div style={{ position: "absolute", bottom: 24, right: 18, fontSize: 8, color: C.ocean+"40", fontFamily: "monospace", pointerEvents: "none" }}>deep thinkers</div>
        <div style={{ position: "absolute", bottom: 24, left: 18, fontSize: 8, color: C.dim, fontFamily: "monospace", pointerEvents: "none" }}>finding footing</div>

        {/* User dot */}
        {pos && (
          <div style={{
            position: "absolute",
            left: `${pos.x}%`, top: `${pos.y}%`,
            transform: "translate(-50%,-50%)",
            pointerEvents: "none",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: `linear-gradient(150deg, ${C.oceanDeep}, ${read?.color || C.tide})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, fontWeight: 600, color: "#e0eef8",
              boxShadow: `0 0 24px ${C.ocean}60`,
              border: `2px solid ${C.sky}`,
            }}>
              {name ? name[0].toUpperCase() : "?"}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!pos && (
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: 12, color: C.dim, fontStyle: "italic",
            pointerEvents: "none", textAlign: "center",
            lineHeight: 1.6,
          }}>
            tap to place yourself
          </div>
        )}
      </div>

      {/* Quadrant read appears after tap */}
      {read && (
        <div style={{
          marginTop: 16, padding: "16px 18px", borderRadius: 10,
          background: C.raised, border: `1px solid ${read.color}40`,
          borderLeft: `3px solid ${read.color}`,
          transition: "all 0.3s ease",
        }}>
          <div style={{ fontSize: 10, color: read.color, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>
            {read.title.toUpperCase()}
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: C.text, fontWeight: 500 }}>
            {read.short}
          </p>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: C.muted, lineHeight: 1.8 }}>
            {read.read}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {read.jobs.map(j => (
              <span key={j} style={{
                fontSize: 10, padding: "3px 9px", borderRadius: 20,
                background: read.color + "18", color: read.color,
                border: `1px solid ${read.color}40`,
              }}>{j}</span>
            ))}
          </div>
        </div>
      )}

      <p style={{ fontSize: 11, color: C.dim, textAlign: "center", margin: "12px 0", fontStyle: "italic" }}>
        {pos ? "tap to reposition gut feeling is fine" : ""}
      </p>

      <Btn onClick={() => next(pos)} disabled={!pos} style={{ marginTop: "auto" }}>
        That's me
      </Btn>
    </div>
  );
}

// ── Step 14: Adam Grenier intro ───────────────────────────────────────────────
function StepAdamIntro({ next }) {
  const visible = useFadeIn([]);
  return (
    <div style={{ ...fadeStyle(visible), padding: "80px 28px 56px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontFamily: "monospace", margin: "0 0 28px" }}>YOUR VALUES</p>

        <h2 style={{ fontSize: 26, fontWeight: 400, margin: "0 0 20px", color: C.pearl, lineHeight: 1.45 }}>
          What do you actually want from work?
        </h2>

        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, margin: "0 0 20px" }}>
          Not the title. Not the salary. The feeling underneath. That's the part that tells you whether a role is actually right.
        </p>

        <p style={{ fontSize: 15, color: C.pearl, lineHeight: 1.85, margin: "0 0 32px", fontStyle: "italic" }}>
          Most people never slow down enough to name it.
        </p>

        <div style={{
          padding: "16px 20px", borderRadius: 12,
          background: C.surface, border: `1px solid ${C.borderSoft}`,
        }}>
          <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.75, margin: 0 }}>
            Shaped and designed by{" "}
            <a
              href="https://www.linkedin.com/in/akgrenier/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: C.ocean, textDecoration: "none" }}
            >Adam Grenier</a>.
          </p>
        </div>
      </div>

      <Btn onClick={next} style={{ marginTop: 36 }}>Let's name it →</Btn>
    </div>
  );
}

// ── Step 16: List — cinematic intro ───────────────────────────────────────────
function StepListDialogue({ name, next }) {
  const visible = useFadeIn([]);
  return (
    <div style={{ ...fadeStyle(visible), minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>

      {/* Full-bleed hero — crowd at night */}
      <div style={{ position: "relative", height: "58vh", overflow: "hidden", flexShrink: 0 }}>
        <img
          src="https://images.pexels.com/photos/1529636/pexels-photo-1529636.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"
          alt=""
          style={{
            width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "center top",
            filter: "saturate(0.55) brightness(0.45)",
          }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(to bottom, rgba(11,15,20,0.2) 0%, transparent 30%, ${C.bg} 100%)`,
        }} />
        <p style={{
          position: "absolute", top: 52, left: 28,
          fontSize: 10, letterSpacing: 3, color: "rgba(180,200,220,0.4)",
          fontFamily: "monospace", margin: 0,
        }}>YOUR LIST</p>
      </div>

      {/* Text — spare, cinematic */}
      <div style={{ padding: "8px 28px 56px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 300, color: C.pearl, lineHeight: 1.4, margin: "0 0 14px" }}>
            {name ? `${name}, they're` : "They're"} already out there.
          </h2>
          <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, margin: "0 0 8px" }}>
            <strong style={{ color: C.pearl }}>Thirty people</strong> whose careers you actually look at and think —
            <em style={{ color: C.pearl }}> I want what they have.</em>
          </p>
          <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.75, margin: "0 0 10px" }}>
            A founder. A professor. A hiring manager at a company you love. Your friend's older sister who somehow got in.
          </p>
          <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.75, margin: 0 }}>
            The list is easier to make than you think. And we can help you build it.
          </p>
        </div>

        <button
          onClick={next}
          style={{
            background: "none", border: "none",
            color: C.muted, fontSize: 13, cursor: "pointer",
            letterSpacing: 1.5, fontFamily: "monospace",
            padding: 0, textAlign: "left",
          }}
        >
          show me how →
        </button>
      </div>

    </div>
  );
}

// ── Step 17: Warm vs Cold ─────────────────────────────────────────────────────
function StepWarmCold({ next }) {
  const visible = useFadeIn([]);
  return (
    <div style={{ ...fadeStyle(visible), minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* COLD — full bleed */}
      <div style={{ background: "#04080f", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "56px 28px 0" }}>
          <p style={{ fontSize: 11, letterSpacing: 2, color: "#2d4055", fontFamily: "monospace", margin: "0 0 16px" }}>THE RULE</p>
          <h2 style={{ fontSize: 28, fontWeight: 300, color: "#4a6070", lineHeight: 1.35, margin: "0 0 6px" }}>
            Cold outreach.
          </h2>
          <p style={{ fontSize: 14, color: "#2d4055", margin: "0 0 20px", lineHeight: 1.7 }}>
            Needs Ash just to get warm. Position of weakness.
          </p>
        </div>

        {/* Pikachu GIF */}
        <div style={{ position: "relative", overflow: "hidden" }}>
          <img
            src="/pikachu-rain.png"
            alt="Pikachu in the rain"
            style={{ width: "100%", height: 220, objectFit: "cover", filter: "saturate(0.3) brightness(0.6)" }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to bottom, #04080f 0%, transparent 20%, #04080f 100%)",
          }} />
          <div style={{
            position: "absolute", bottom: 16, left: 28,
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            {["a stranger's inbox", "zero context", "~0.3% reply rate"].map(t => (
              <span key={t} style={{ fontSize: 11, color: "#3a5560", fontFamily: "monospace" }}>— {t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* WARM — full bleed */}
      <div style={{ background: "#100900", flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Charmander GIF */}
        <div style={{ position: "relative", overflow: "hidden" }}>
          <img
            src="https://gifdb.com/images/high/charmander-flame-thrower-fire-qxys4rpoptjp8tqq.gif"
            alt="Charmander flame thrower"
            style={{ width: "100%", height: 220, objectFit: "cover", filter: "saturate(1.4) brightness(0.85)" }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to bottom, #100900 0%, transparent 20%, #100900 100%)",
          }} />
          <div style={{
            position: "absolute", top: 16, right: 20,
            display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end",
          }}>
            {["a mutual connection", "context that matters", "40–70% reply rate"].map(t => (
              <span key={t} style={{ fontSize: 11, color: "#a06020", fontFamily: "monospace" }}>— {t}</span>
            ))}
          </div>
        </div>

        <div style={{ padding: "0 28px 32px" }}>
          <h2 style={{ fontSize: 28, fontWeight: 300, color: "#e08830", lineHeight: 1.35, margin: "0 0 6px" }}>
            Warm intro.
          </h2>
          <p style={{ fontSize: 14, color: "#a06830", margin: "0 0 24px", lineHeight: 1.7 }}>
            Small, but bursting with warmth. Exudes energy. Proactive.
          </p>

          <div style={{ padding: "18px 20px", borderRadius: 12, background: "#1a0e00", border: "1px solid #cc780030", marginBottom: 10 }}>
            <p style={{ fontSize: 15, color: "#e08830", lineHeight: 1.8, margin: "0 0 8px", fontWeight: 400 }}>
              Why go cold when you can go warm?
            </p>
            <p style={{ fontSize: 13, color: "#a06020", lineHeight: 1.75, margin: 0 }}>
              Cold outreach is devil's advocacy. Literally advocating for the devil. A demon. Why would you do that to yourself?
            </p>
          </div>

          <p style={{ fontSize: 12, color: "#6a4010", margin: "0 0 28px", fontStyle: "italic", textAlign: "center" }}>
            warm is always better. this is not up for debate.
          </p>

          <Btn onClick={next}>always go warm. let's build the list →</Btn>
        </div>
      </div>

    </div>
  );
}

// ── Step 18: List builder ─────────────────────────────────────────────────────
function StepListBuilder({ contacts = [], update, next }) {
  const visible = useFadeIn([]);
  const [input, setInput] = useState("");
  const [list, setList] = useState(contacts.length ? contacts : []);

  const addName = () => {
    const name = input.trim();
    if (!name) return;
    setList(prev => [...prev, { name }]);
    setInput("");
  };

  return (
    <div style={{ ...fadeStyle(visible), padding: "72px 28px 48px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: C.ocean, fontFamily: "monospace", margin: "0 0 20px" }}>YOUR LIST</p>
        <h2 style={{ fontSize: 26, fontWeight: 300, color: C.pearl, lineHeight: 1.4, margin: "0 0 10px" }}>
          Who do you actually want to talk to?
        </h2>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.8, margin: "0 0 24px" }}>
          Heroes, mentors, people in roles you want. Don't filter yet — just name them.
        </p>

        {/* Input row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addName()}
            placeholder="a name, a company, a role..."
            autoFocus
            style={{
              flex: 1, background: C.surface, border: `1px solid ${input ? C.ocean : C.border}`,
              borderRadius: 10, padding: "13px 16px", fontSize: 15, color: C.text,
              outline: "none", fontFamily: "Georgia, serif", transition: "border-color 0.2s",
            }}
          />
          <button onClick={addName} style={{
            background: C.ocean, border: "none", borderRadius: 10,
            padding: "13px 20px", color: C.bg, fontSize: 20,
            cursor: "pointer", fontWeight: 600, lineHeight: 1,
          }}>+</button>
        </div>

        {/* Empty state */}
        {list.length === 0 && (
          <p style={{ fontSize: 13, color: C.dim, fontStyle: "italic", margin: "0 0 20px" }}>
            Your list is empty. Start with whoever comes to mind first.
          </p>
        )}

        {/* The list */}
        {list.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {list.map((c, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: C.surface, border: `1px solid ${C.borderSoft}`,
                borderRadius: 10, padding: "12px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 11, color: C.dim, fontFamily: "monospace", minWidth: 20 }}>{i + 1}</span>
                  <span style={{ fontSize: 15, color: C.pearl }}>{c.name}</span>
                </div>
                <button
                  onClick={() => setList(prev => prev.filter((_, j) => j !== i))}
                  style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 17, padding: "2px 6px", lineHeight: 1 }}
                >×</button>
              </div>
            ))}
          </div>
        )}

        {/* Encouragement */}
        {list.length > 0 && list.length < 5 && (
          <p style={{ fontSize: 13, color: C.dim, margin: "0 0 8px" }}>
            Good start. Keep going — aim for at least five.
          </p>
        )}
        {list.length >= 5 && (
          <p style={{ fontSize: 13, color: "#e08830", margin: "0 0 8px" }}>
            🔥 {list.length} people. That's a real list.
          </p>
        )}
      </div>

      <Btn onClick={() => { update({ contacts: list }); next(list); }} disabled={list.length === 0}>
        {list.length === 0 ? "add at least one →" : `that's my list (${list.length}) →`}
      </Btn>
      {list.length === 0 && (
        <button
          onClick={() => { update({ contacts: [] }); next([]); }}
          style={{ marginTop: 14, background: "none", border: "none", color: C.dim, fontSize: 12, cursor: "pointer", fontFamily: "Georgia, serif", letterSpacing: 0.3 }}
        >
          skip for now
        </button>
      )}
    </div>
  );
}

// ── Step 17: List Reveal ───────────────────────────────────────────────────────
function StepListReveal({ contacts = [], name, next }) {
  const visible = useFadeIn([]);
  const list = contacts.filter(c => c.name || (c.firstName && c.firstName.trim()));

  return (
    <div style={{ ...fadeStyle(visible), padding: "72px 28px 48px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: C.ocean, fontFamily: "monospace", margin: "0 0 20px" }}>
          YOUR STARTING LINEUP
        </p>
        <h2 style={{ fontSize: 28, fontWeight: 300, color: C.pearl, lineHeight: 1.4, margin: "0 0 8px" }}>
          Look at that.
        </h2>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.8, margin: "0 0 28px" }}>
          {list.length > 0
            ? `${list.length} ${list.length === 1 ? "person" : "people"} in your corner. That's how it starts.`
            : "Your list lives in your dashboard. You can add people any time."}
        </p>

        {/* Contact list — Salesforce-style */}
        {list.length > 0 && (
          <div style={{
            background: C.surface, borderRadius: 14,
            border: `1px solid ${C.borderSoft}`, overflow: "hidden",
            marginBottom: 20,
          }}>
            {/* Header row */}
            <div style={{
              display: "grid", gridTemplateColumns: "34px 1fr 56px",
              gap: 10, padding: "9px 16px",
              borderBottom: `1px solid ${C.borderSoft}`,
            }}>
              {["", "NAME", "LEAD"].map((h, i) => (
                <span key={i} style={{ fontSize: 9, color: C.dim, fontFamily: "monospace", letterSpacing: 1 }}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            {list.slice(0, 8).map((c, i) => {
              const displayName = c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim();
              return (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "34px 1fr 56px",
                  gap: 10, padding: "10px 16px", alignItems: "center",
                  borderBottom: i < Math.min(list.length, 8) - 1 ? `1px solid ${C.borderSoft}` : "none",
                  background: i % 2 === 0 ? "transparent" : `${C.raised}70`,
                }}>
                  <Avatar name={displayName} size={26} />
                  <span style={{ fontSize: 14, color: C.text }}>{displayName}</span>
                  <span style={{
                    fontSize: 9, fontFamily: "monospace", padding: "3px 7px", borderRadius: 20,
                    background: `${C.ocean}15`, color: C.sky,
                    border: `1px solid ${C.ocean}30`, textAlign: "center",
                  }}>warm</span>
                </div>
              );
            })}

            {list.length > 8 && (
              <div style={{
                padding: "10px 16px", fontSize: 11, color: C.dim,
                fontFamily: "monospace", textAlign: "center",
                borderTop: `1px solid ${C.borderSoft}`,
              }}>
                +{list.length - 8} more in your dashboard
              </div>
            )}
          </div>
        )}

        {/* Progress bar */}
        {list.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>progress to 30</span>
              <span style={{ fontSize: 11, color: C.ocean, fontFamily: "monospace" }}>{list.length}/30</span>
            </div>
            <div style={{ height: 3, background: C.borderSoft, borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.min((list.length / 30) * 100, 100)}%`,
                background: `linear-gradient(90deg, ${C.oceanDeep}, ${C.ocean})`,
                borderRadius: 4,
              }} />
            </div>
          </div>
        )}

        <div style={{
          padding: "16px 18px", borderRadius: 10,
          background: C.surface, border: `1px solid ${C.borderSoft}`,
          borderLeft: `2px solid ${C.seafoam}`,
        }}>
          <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.85, fontStyle: "italic" }}>
            You can keep adding to this in your dashboard. The goal isn't to hit 30 today — it's to start somewhere real.
          </p>
        </div>
      </div>

      <Btn onClick={next} style={{ marginTop: 32 }}>looks good →</Btn>
    </div>
  );
}

// ── Step 18: Breath ────────────────────────────────────────────────────────────
function StepBreath({ name, contacts = [], selfPosition, next }) {
  const visible = useFadeIn([]);
  const quadrant = selfPosition ? getQuadrant(selfPosition.x, selfPosition.y) : null;
  const qr = quadrant ? QUADRANT_READS[quadrant] : null;
  const listCount = contacts.filter(c => c.name || c.firstName).length;

  const milestones = [
    { text: "Placed yourself on the matrix" },
    { text: "Wrote down what scares you" },
    { text: "Thought about what excites you" },
    listCount > 0 ? { text: `Named ${listCount} ${listCount === 1 ? "person" : "people"} in your corner` } : { text: "Thought about who can help" },
  ];

  return (
    <div style={{
      ...fadeStyle(visible),
      display: "flex", flexDirection: "column",
      justifyContent: "center", alignItems: "center",
      minHeight: "100vh", padding: "48px 32px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 44, marginBottom: 36, opacity: 0.55, letterSpacing: 8 }}>〰</div>

      <div style={{ maxWidth: 320, marginBottom: 48 }}>
        <h2 style={{ fontSize: 26, fontWeight: 300, color: C.pearl, lineHeight: 1.5, margin: "0 0 16px", letterSpacing: -0.5 }}>
          You've done a lot.
        </h2>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.9, margin: "0 0 32px" }}>
          Seriously. Most people skip the hard parts. You didn't.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left", marginBottom: 32 }}>
          {milestones.map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: C.seafoam, fontSize: 14, flexShrink: 0 }}>✓</span>
              <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{m.text}</span>
            </div>
          ))}
        </div>

        {qr && (
          <div style={{
            padding: "14px 18px", borderRadius: 10,
            background: C.surface, border: `1px solid ${C.borderSoft}`,
            borderLeft: `3px solid ${qr.color}`,
            textAlign: "left",
          }}>
            <div style={{ fontSize: 10, color: qr.color, fontFamily: "monospace", letterSpacing: 1, marginBottom: 4 }}>
              YOU: {qr.title.toUpperCase()}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.8 }}>{qr.short}</p>
          </div>
        )}
      </div>

      <div style={{ width: "100%", maxWidth: 320 }}>
        <Btn onClick={next}>one more thing →</Btn>
      </div>

      <p style={{ fontSize: 11, color: C.dim, marginTop: 20, fontStyle: "italic" }}>almost done</p>
    </div>
  );
}

// ── Step 19: Wants + Feelings ──────────────────────────────────────────────────
function StepWants({ wants, update, next }) {
  const visible = useFadeIn([]);
  const [items, setItems] = useState(
    SEED_WANTS.map(w => ({ text: w, feeling: null }))
  );
  const [customText, setCustomText] = useState("");
  const [activePicker, setActivePicker] = useState(null);

  const setFeeling = (idx, feeling) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, feeling } : it));
    setActivePicker(null);
  };

  const clearFeeling = (e, idx) => {
    e.stopPropagation();
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, feeling: null } : it));
    setActivePicker(null);
  };

  const addCustom = () => {
    if (!customText.trim()) return;
    setItems(prev => [...prev, { text: customText.trim(), feeling: null }]);
    setCustomText("");
  };

  const tagged = items.filter(i => i.feeling).length;

  return (
    <div style={{ ...fadeStyle(visible), padding: "72px 0 0", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "0 28px", marginBottom: 24 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontFamily: "monospace", margin: "0 0 16px" }}>YOUR VALUES</p>
        <h2 style={{ fontSize: 24, fontWeight: 400, margin: "0 0 10px", color: C.pearl, lineHeight: 1.35 }}>
          What are you really after?
        </h2>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: 0 }}>
          Tap a want → then pick the feeling behind it.
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((item, idx) => (
            <div key={idx}>
              <div
                onClick={() => setActivePicker(activePicker === idx ? null : idx)}
                style={{
                  padding: "14px 16px",
                  borderRadius: activePicker === idx ? "10px 10px 0 0" : 10,
                  background: C.surface,
                  border: `1px solid ${item.feeling ? C.tide : activePicker === idx ? C.ocean : C.borderSoft}`,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  cursor: "pointer", transition: "border-color 0.15s",
                }}
              >
                <span style={{ fontSize: 13, color: item.feeling ? C.text : C.muted, flex: 1 }}>{item.text}</span>
                {item.feeling ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 10, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 10, padding: "3px 10px", borderRadius: 20,
                      background: (FEELINGS.find(f => f.id === item.feeling)?.color || C.ocean) + "20",
                      color: FEELINGS.find(f => f.id === item.feeling)?.color || C.ocean,
                      border: `1px solid ${(FEELINGS.find(f => f.id === item.feeling)?.color || C.ocean)}40`,
                      whiteSpace: "nowrap",
                    }}>{item.feeling}</span>
                    <span
                      onClick={(e) => clearFeeling(e, idx)}
                      style={{ fontSize: 16, color: C.muted, lineHeight: 1, cursor: "pointer", padding: "2px 4px" }}
                    >×</span>
                  </div>
                ) : (
                  <span style={{
                    fontSize: 11, marginLeft: 10, flexShrink: 0,
                    color: activePicker === idx ? C.ocean : C.dim,
                  }}>
                    {activePicker === idx ? "pick one ↓" : "tag →"}
                  </span>
                )}
              </div>

              {activePicker === idx && (
                <div style={{
                  background: C.raised, border: `1px solid ${C.ocean}`,
                  borderTop: "none", borderRadius: "0 0 10px 10px",
                  padding: "10px 12px 14px",
                  maxHeight: 300, overflowY: "auto",
                }}>
                  <p style={{ fontSize: 10, color: C.ocean, fontFamily: "monospace", letterSpacing: 1.5, margin: "0 0 8px" }}>
                    CHOOSE THE FEELING BEHIND IT
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {FEELINGS.map(f => (
                      <div
                        key={f.id}
                        onClick={() => setFeeling(idx, f.id)}
                        style={{
                          padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                          background: item.feeling === f.id ? f.color + "22" : "transparent",
                          border: `1px solid ${item.feeling === f.id ? f.color + "55" : "transparent"}`,
                          transition: "all 0.1s",
                        }}
                      >
                        <div style={{ fontSize: 13, color: f.color, fontWeight: item.feeling === f.id ? 600 : 400, marginBottom: 2 }}>{f.id}</div>
                        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{f.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add custom */}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <input
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCustom()}
              placeholder="add your own want..."
              style={{
                flex: 1, background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: "12px 14px", fontSize: 13,
                color: C.text, outline: "none", fontFamily: "Georgia, serif",
              }}
            />
            <div
              onClick={addCustom}
              style={{
                padding: "12px 16px", borderRadius: 10, background: C.faint,
                color: C.muted, cursor: "pointer", fontSize: 18, lineHeight: 1,
                display: "flex", alignItems: "center",
              }}
            >+</div>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 28px 36px", borderTop: `1px solid ${C.borderSoft}` }}>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 12, textAlign: "center" }}>
          {tagged < 3 ? `${3 - tagged} more to go` : "looking good ✓"}
        </div>
        <Btn onClick={() => next(items)} disabled={tagged < 3}>
          {tagged < 3 ? `tag ${3 - tagged} more` : "Let's go"}
        </Btn>
      </div>
    </div>
  );
}

// ── Step 4: First Person ──────────────────────────────────────────────────────
// ── VoiceOrText — reusable voice/text input ────────────────────────────────
function VoiceOrText({ value, onChange, placeholder }) {
  const [mode, setMode] = useState(null); // null | "text" | "voice"
  const [listening, setListening] = useState(false);
  const recogRef = useRef(null);
  const supported = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SR();
    recogRef.current = recog;
    recog.continuous = true;
    recog.interimResults = true;
    recog.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      onChange(transcript);
    };
    recog.onerror = () => stopListening();
    recog.onend = () => setListening(false);
    recog.start();
    setListening(true);
  };

  const stopListening = () => {
    if (recogRef.current) { recogRef.current.stop(); recogRef.current = null; }
    setListening(false);
  };

  const toggleVoice = () => { if (listening) stopListening(); else startListening(); };

  // Mode picker — shown on first load
  if (mode === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          onClick={() => setMode("text")}
          style={{
            padding: "20px", borderRadius: 12, cursor: "pointer",
            background: C.surface, border: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", gap: 16,
          }}
        >
          <span style={{ fontSize: 24 }}>✍️</span>
          <div>
            <div style={{ fontSize: 14, color: C.pearl, fontWeight: 500, marginBottom: 3 }}>Type it</div>
            <div style={{ fontSize: 12, color: C.muted }}>Write out your thoughts</div>
          </div>
        </div>
        {supported && (
          <div
            onClick={() => { setMode("voice"); startListening(); }}
            style={{
              padding: "20px", borderRadius: 12, cursor: "pointer",
              background: C.surface, border: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", gap: 16,
            }}
          >
            <span style={{ fontSize: 24 }}>🎙️</span>
            <div>
              <div style={{ fontSize: 14, color: C.pearl, fontWeight: 500, marginBottom: 3 }}>Say it</div>
              <div style={{ fontSize: 12, color: C.muted }}>Speak your answer aloud</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {mode === "voice" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
            background: listening ? C.ocean : C.muted,
            animation: listening ? "pulse 1.2s ease-in-out infinite" : "none",
          }} />
          <span style={{ fontSize: 12, color: listening ? C.ocean : C.muted }}>
            {listening ? "Listening…" : "Paused"}
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <div
              onClick={toggleVoice}
              style={{
                padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontSize: 11,
                background: listening ? C.faint : C.ocean + "22",
                color: listening ? C.muted : C.ocean,
                border: `1px solid ${listening ? C.border : C.ocean + "44"}`,
              }}
            >{listening ? "Pause" : "Resume"}</div>
            <div
              onClick={() => { stopListening(); setMode("text"); }}
              style={{
                padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontSize: 11,
                background: C.faint, color: C.muted, border: `1px solid ${C.border}`,
              }}
            >Switch to text</div>
          </div>
        </div>
      )}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: C.surface, border: `1px solid ${value ? C.ocean : C.border}`,
          borderRadius: 10, padding: "14px 16px", fontSize: 13,
          color: C.text, outline: "none", fontFamily: "Georgia, serif",
          resize: "none", minHeight: 120, lineHeight: 1.7,
          width: "100%", boxSizing: "border-box", transition: "border-color 0.2s",
        }}
      />
      {mode === "text" && supported && (
        <div
          onClick={() => { setMode("voice"); startListening(); }}
          style={{ fontSize: 12, color: C.muted, textAlign: "center", cursor: "pointer", textDecoration: "underline" }}
        >Switch to voice instead</div>
      )}
    </div>
  );
}

// ── Step 6: Pause — terminal screen ──────────────────────────────────────────
function TideWave() {
  const pathRef = useRef(null);
  const path2Ref = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    let t = 0;
    const W = 280, H = 48;
    const draw = () => {
      t += 0.018;
      const amp1 = 9 + Math.sin(t * 0.4) * 4;  // breathing amplitude
      const amp2 = 6 + Math.sin(t * 0.3 + 1) * 3;

      if (pathRef.current) {
        let d = `M0,${H}`;
        for (let x = 0; x <= W; x += 3) {
          const y = H * 0.45 + Math.sin(x * 0.045 + t) * amp1;
          d += ` L${x},${y}`;
        }
        d += ` L${W},${H} Z`;
        pathRef.current.setAttribute("d", d);
      }

      if (path2Ref.current) {
        let d2 = `M0,${H}`;
        for (let x = 0; x <= W; x += 3) {
          const y = H * 0.55 + Math.sin(x * 0.04 + t * 0.75 + 2) * amp2;
          d2 += ` L${x},${y}`;
        }
        d2 += ` L${W},${H} Z`;
        path2Ref.current.setAttribute("d", d2);
      }

      frameRef.current = requestAnimationFrame(draw);
    };
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <svg width="280" height="48" style={{ display: "block", margin: "0 auto", overflow: "visible" }}>
      <defs>
        <linearGradient id="tide1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.ocean} stopOpacity="0.5" />
          <stop offset="100%" stopColor={C.ocean} stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id="tide2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.seafoam} stopOpacity="0.3" />
          <stop offset="100%" stopColor={C.seafoam} stopOpacity="0.06" />
        </linearGradient>
      </defs>
      <path ref={path2Ref} fill="url(#tide2)" />
      <path ref={pathRef} fill="url(#tide1)" />
    </svg>
  );
}

function StepPause({ next }) {
  const visible = useFadeIn([]);
  return (
    <div style={{
      ...fadeStyle(visible),
      minHeight: "100vh",
      display: "flex", flexDirection: "column",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "0",
      textAlign: "center",
      background: C.bg,
    }}>

      {/* Top space */}
      <div style={{ flex: 1 }} />

      {/* Center content */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
        <p style={{ fontSize: 11, letterSpacing: 3, color: C.dim, fontFamily: "monospace", margin: "0 0 52px" }}>
          {TAGLINE}
        </p>

        {/* Wave — scaled up for presence */}
        <div style={{ transform: "scale(1.5)", transformOrigin: "center", marginBottom: 52 }}>
          <TideWave />
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 300, color: C.pearl, margin: "0 0 14px", letterSpacing: 0.5 }}>
          You named it.
        </h2>
        <p style={{ fontSize: 14, color: C.dim, lineHeight: 1.8, margin: 0, maxWidth: 220 }}>
          That's rare. Sit with it.
        </p>
      </div>

      {/* Bottom — barely-there continue */}
      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", paddingBottom: 52 }}>
        <button
          onClick={next}
          style={{
            background: "none", border: "none",
            color: C.muted, fontSize: 13, cursor: "pointer",
            letterSpacing: 1.5, fontFamily: "monospace",
            opacity: 0.7,
          }}
        >
          continue
        </button>
      </div>

    </div>
  );
}

// ── Step 11: Phone ────────────────────────────────────────────────────────────
function StepPhone({ next }) {
  const visible = useFadeIn([]);
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState(null);

  const inputStyle = {
    width: "100%", background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: "15px 18px", fontSize: 16, color: C.text,
    outline: "none", fontFamily: "Georgia, serif", boxSizing: "border-box",
    letterSpacing: 0.5,
  };

  const handleSend = async () => {
    const cleaned = phone.trim().replace(/[\s\-().]/g, "");
    if (!cleaned) { next(""); return; }
    setSending(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: cleaned });
      if (error) throw error;
      setOtpSent(true);
    } catch {
      // Twilio not configured — save number and continue
      next(phone.trim());
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    setSending(true);
    setError(null);
    try {
      const cleaned = phone.trim().replace(/[\s\-().]/g, "");
      const { error } = await supabase.auth.verifyOtp({ phone: cleaned, token: otp, type: "sms" });
      if (error) throw error;
      next(phone.trim());
    } catch {
      setError("That code didn't match. Try again.");
      setSending(false);
    }
  };

  return (
    <div style={{ ...fadeStyle(visible), padding: "72px 28px 48px", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      {!otpSent ? (
        <>
          <p style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontFamily: "monospace", margin: "0 0 20px" }}>ONE LAST THING</p>
          <h2 style={{ fontSize: 26, fontWeight: 400, color: C.pearl, lineHeight: 1.4, margin: "0 0 14px" }}>
            Drop your number.
          </h2>
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.75, margin: "0 0 32px", maxWidth: 300 }}>
            We'll text you a quick recap of what you named today, and reach out when something new is ready.
          </p>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+1 (555) 000-0000"
            style={inputStyle}
            autoFocus
          />
          <div style={{ marginTop: 14 }}>
            <Btn onClick={handleSend} disabled={sending}>
              {sending ? "sending..." : "send recap →"}
            </Btn>
          </div>
          <button
            onClick={() => next("")}
            style={{ marginTop: 18, background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", fontFamily: "Georgia, serif", letterSpacing: 0.3 }}
          >
            skip for now
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 11, letterSpacing: 2, color: C.ocean, fontFamily: "monospace", margin: "0 0 20px" }}>CHECK YOUR TEXTS</p>
          <h2 style={{ fontSize: 26, fontWeight: 400, color: C.pearl, lineHeight: 1.4, margin: "0 0 14px" }}>
            Enter the code.
          </h2>
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.75, margin: "0 0 32px" }}>
            Sent to {phone}.
          </p>
          <input
            type="number"
            value={otp}
            onChange={e => setOtp(e.target.value.slice(0, 6))}
            placeholder="000000"
            style={{ ...inputStyle, fontSize: 24, letterSpacing: 8, textAlign: "center" }}
            autoFocus
          />
          {error && <p style={{ fontSize: 12, color: "#e07070", margin: "10px 0 0", textAlign: "center" }}>{error}</p>}
          <div style={{ marginTop: 14 }}>
            <Btn onClick={handleVerify} disabled={sending || otp.length < 6}>
              {sending ? "verifying..." : "verify →"}
            </Btn>
          </div>
          <button
            onClick={() => next(phone.trim())}
            style={{ marginTop: 18, background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", fontFamily: "Georgia, serif", letterSpacing: 0.3 }}
          >
            skip verification
          </button>
        </>
      )}
    </div>
  );
}

// ── Step 10: Careers Over Cash ────────────────────────────────────────────────
function StepCareersOverCash({ next }) {
  const visible = useFadeIn([]);
  const p = (txt, col = C.muted) => (
    <p style={{ fontSize: 15, color: col, lineHeight: 1.85, margin: "0 0 20px" }}>{txt}</p>
  );

  return (
    <div style={{ ...fadeStyle(visible), padding: "72px 28px 56px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 20, marginBottom: 20, background: C.faint, border: `1px solid ${C.borderSoft}` }}>
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.ocean }} />
        <span style={{ fontSize: 10, letterSpacing: 2, color: C.muted, fontFamily: "monospace" }}>COVE ETHOS</span>
      </div>
      <h2 style={{ fontSize: 26, fontWeight: 400, margin: "0 0 24px", color: C.pearl, lineHeight: 1.45 }}>
        It's about careers, over cash.
      </h2>

      <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, margin: "0 0 20px" }}>
        In <em style={{ color: C.pearl }}>Kid Gorgeous</em>, his 2018 Netflix special, John Mulaney does a bit about paying $120,000 to Georgetown for an English degree — "a language," he says, "I already spoke. Fluently. For free. Since I was three." Four years later, $120k gone, the university called asking for a donation.
      </p>

      <div style={{ margin: "0 0 24px", borderRadius: 12, overflow: "hidden", lineHeight: 0 }}>
        <img
          src="/mulaney.jpeg"
          alt="John Mulaney — and now you have the audacity to ask me for more money."
          style={{ width: "100%", borderRadius: 12, display: "block" }}
        />
        <p style={{ fontSize: 9, color: C.dim, margin: "6px 0 0", letterSpacing: 1, textTransform: "uppercase" }}>John Mulaney · Kid Gorgeous (2018)</p>
      </div>

      <blockquote style={{
        margin: "0 0 28px",
        padding: "20px 24px",
        borderLeft: `3px solid ${C.ocean}`,
        background: C.surface,
        borderRadius: "0 10px 10px 0",
      }}>
        <p style={{ fontSize: 20, fontWeight: 300, color: C.pearl, lineHeight: 1.5, margin: "0 0 10px", fontStyle: "italic" }}>
          "and now you have the audacity to ask me for more money?"
        </p>
        <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>— John Mulaney, <em>Kid Gorgeous</em> (2018)</p>
      </blockquote>

      {p("The joke lands because most graduates know the feeling. You paid, showed up, did everything the system asked — and walked out the other side with a credential and no real map. Career services gave you a template. Your professors cared about the discipline, not what came after. The people who could've helped were somewhere else, untapped.", C.pearl)}

      {p("Turns out the most important thing college was supposed to give you wasn't the degree.")}

      <div style={{
        padding: "20px 22px", borderRadius: 12, marginBottom: 28,
        background: C.surface, border: `1px solid ${C.borderSoft}`,
      }}>
        <div style={{ fontSize: 42, fontWeight: 300, color: C.ocean, lineHeight: 1, marginBottom: 10, letterSpacing: -1 }}>57%</div>
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.65, marginBottom: 8 }}>Alumni relationships — not career services, not workshops — are what actually prepares graduates for work.</div>
        <div style={{ fontSize: 10, color: C.dim, fontStyle: "italic" }}>Inside Higher Ed, 2023</div>
      </div>

      <blockquote style={{
        margin: "0 0 28px",
        padding: "20px 24px",
        borderLeft: `3px solid ${C.seafoam}`,
        background: C.surface,
        borderRadius: "0 10px 10px 0",
      }}>
        <p style={{ fontSize: 17, fontWeight: 300, color: C.pearl, lineHeight: 1.6, margin: "0 0 10px", fontStyle: "italic" }}>
          "You just have to be the one who shows up."
        </p>
        <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>— Gwen Stacy, Spider-Man: Into the Spider-Verse</p>
      </blockquote>

      {p("One conversation. Twenty minutes. Someone who's been where you're trying to go. That's the whole model — and it's what Cove is built around.", C.pearl)}

      <Btn onClick={next} style={{ marginTop: 8 }}>I'm in.</Btn>
    </div>
  );
}

// ── Step 4: Matrix Pause + Return Check-in ───────────────────────────────────
// eslint-disable-next-line no-unused-vars
const QUADRANT_TASKS = {
  "brave-curious": {
    headline: "You're moving and you're open.",
    task: "Before you come back: reach out to one person in your network you haven't talked to in a year. No agenda. Just check in.",
  },
  "brave-judgmental": {
    headline: "You're willing to move. Stay open about where.",
    task: "Before you come back: spend 20 minutes listening to someone whose career path looks nothing like yours. Podcast, interview, conversation. Just listen.",
  },
  "fearful-curious": {
    headline: "You see it. Something's holding you back.",
    task: "Before you come back: write down the one career move you keep circling but haven't made. Don't share it. Just put it somewhere real.",
  },
  "fearful-judgmental": {
    headline: "You're in a careful place right now. That's okay.",
    task: "Before you come back: do one thing today that feels even slightly uncomfortable. Doesn't have to be career-related. Just move.",
  },
};

const QUADRANT_PAUSE = {
  "brave-curious": {
    opener: "You're already in motion.",
    question: "What would it look like to slow down just enough to pick the right direction?",
  },
  "brave-judgmental": {
    opener: "You know what you want.",
    question: "Where have you been most willing to be wrong lately?",
  },
  "fearful-curious": {
    opener: "You see more than you let on.",
    question: "What would you try if you knew no one was judging?",
  },
  "fearful-judgmental": {
    opener: "Something's made you careful. That's okay.",
    question: "Who has seen you at your best — and when did they last say so?",
  },
};

function StepMatrixPause({ selfPosition, next, goBack }) {
  const visible = useFadeIn([]);
  const quadrant = selfPosition ? getQuadrant(selfPosition.x, selfPosition.y) : "fearful-curious";
  const qr = QUADRANT_READS[quadrant];
  const qp = QUADRANT_PAUSE[quadrant];

  const [quadrantStats, setQuadrantStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("matrix_sessions")
      .select("quadrant")
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) { setStatsLoading(false); return; }
        const counts = {};
        data.forEach(row => {
          const k = row.quadrant || "Unknown";
          counts[k] = (counts[k] || 0) + 1;
        });
        const total = data.length;
        // Map back to quadrant keys for color lookup
        const titleToKey = {};
        Object.entries(QUADRANT_READS).forEach(([k, v]) => { titleToKey[v.title] = k; });
        const stats = Object.entries(counts)
          .map(([title, count]) => ({
            title,
            count,
            pct: Math.round((count / total) * 100),
            color: QUADRANT_READS[titleToKey[title]]?.color || C.muted,
          }))
          .sort((a, b) => b.count - a.count);
        setQuadrantStats(stats);
        setStatsLoading(false);
      });
  }, []);

  return (
    <div style={{ ...fadeStyle(visible), minHeight: "100vh", padding: "72px 28px 64px", display: "flex", flexDirection: "column" }}>

      {/* Pulsing heart */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 48, display: "inline-block", animation: "pulse 2.8s ease-in-out infinite", marginBottom: 24 }}>
          💙
        </div>
        <p style={{ fontSize: 11, letterSpacing: 3, color: C.muted, fontFamily: "monospace", margin: "0 0 10px" }}>COVE</p>
        <p style={{ fontSize: 15, color: C.muted, fontStyle: "italic" }}>alright, now pause.</p>
      </div>

      {/* Opener — forked by quadrant */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: qr.color, letterSpacing: 2, fontFamily: "monospace", marginBottom: 10, textTransform: "uppercase" }}>
          {qr.title}
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 400, color: C.pearl, lineHeight: 1.4, margin: "0 0 16px" }}>
          {qp.opener}
        </h2>
        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, margin: 0 }}>
          {qr.read}
        </p>
      </div>

      {/* Question to hold */}
      <div style={{
        padding: "20px 22px", borderRadius: 12, marginBottom: 36,
        background: C.surface, border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${qr.color}`,
      }}>
        <p style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", letterSpacing: 1.5, textTransform: "uppercase", margin: "0 0 10px" }}>
          sit with this
        </p>
        <p style={{ fontSize: 15, color: C.pearl, lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>
          "{qp.question}"
        </p>
      </div>

      {/* Where others landed */}
      <div style={{ marginBottom: 28 }}>
        <SectionLabel>where others landed</SectionLabel>
        {statsLoading ? (
          <div style={{ fontSize: 12, color: C.dim, fontFamily: "monospace", letterSpacing: 1 }}>loading...</div>
        ) : quadrantStats ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {quadrantStats.map(stat => (
              <div key={stat.title}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: stat.color, fontFamily: "monospace", letterSpacing: 0.5 }}>{stat.title}</span>
                  <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{stat.pct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: C.faint, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 3,
                    width: `${stat.pct}%`,
                    background: stat.color,
                    opacity: 0.7,
                    transition: "width 0.6s ease",
                  }} />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Back link */}
      <button
        onClick={goBack}
        style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", padding: "0 0 28px", textAlign: "left", fontFamily: "Georgia, serif" }}
      >
        that's not me, move my dot
      </button>

      <Btn onClick={next}>keep going</Btn>
    </div>
  );
}

// ── Step 6: Quadrant Reveal ───────────────────────────────────────────────────
function StepQuadrantReveal({ selfPosition, next }) {
  const [visible, setVisible] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [gwVisible, setGwVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 80);
    const t2 = setTimeout(() => setGwVisible(true), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const quadrant = selfPosition ? getQuadrant(selfPosition.x, selfPosition.y) : "brave-curious";
  const qr = QUADRANT_READS[quadrant];
  const imageUrl = getQuadrantImage(quadrant);

  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transition: "opacity 0.9s ease",
      display: "flex", flexDirection: "column",
      minHeight: "100vh", textAlign: "center",
      background: C.bg,
    }}>
      {/* Full-bleed landscape banner */}
      <div style={{ position: "relative", height: 260, overflow: "hidden", flexShrink: 0 }}>
        {/* Colour wash fallback — always visible */}
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(135deg, ${qr.color}28 0%, ${C.bg} 100%)`,
        }} />
        {/* Landscape photo */}
        <img
          src={imageUrl}
          alt=""
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover",
            opacity: imgLoaded ? 0.55 : 0,
            transition: "opacity 1s ease",
            filter: "saturate(0.7) brightness(0.85)",
          }}
          onLoad={() => setImgLoaded(true)}
        />
        {/* Colour tint overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: `${qr.color}18`,
          mixBlendMode: "color",
        }} />
        {/* Bottom fade into bg */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 100,
          background: `linear-gradient(to bottom, transparent, ${C.bg})`,
        }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "8px 28px 48px" }}>
        <div style={{ maxWidth: 340, width: "100%" }}>
          {/* Dot */}
          <div style={{ marginBottom: 24 }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: `radial-gradient(circle at 35% 35%, ${qr.color}45, ${qr.color}10)`,
              border: `1px solid ${qr.color}40`,
              margin: "0 auto",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 28px ${qr.color}20`,
            }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: qr.color, opacity: 0.8 }} />
            </div>
          </div>

          <p style={{ fontSize: 11, letterSpacing: 3, color: qr.color, fontFamily: "monospace", margin: "0 0 14px" }}>
            YOU PLACED YOURSELF
          </p>

          <h1 style={{ fontSize: 36, fontWeight: 300, color: C.pearl, lineHeight: 1.2, margin: "0 0 18px", letterSpacing: -0.5 }}>
            {qr.title}
          </h1>

          <p style={{ fontSize: 17, color: C.mist, lineHeight: 1.75, margin: "0 0 36px", fontStyle: "italic" }}>
            {qr.short}
          </p>

          {/* GW ok */}
          <div style={{
            opacity: gwVisible ? 1 : 0,
            transform: gwVisible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.95)",
            transition: "opacity 0.7s ease, transform 0.7s ease",
            marginBottom: 36,
          }}>
            <img
              src="/gw-ok.png"
              alt=""
              style={{
                width: 130, height: "auto",
                filter: "saturate(0.25) brightness(1.1) contrast(0.9)",
                opacity: 0.55,
                mixBlendMode: "screen",
                borderRadius: 12,
              }}
            />
            <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", letterSpacing: 2, marginTop: 6 }}>
              nice.
            </div>
          </div>

          <Btn onClick={next}>What does this mean for you? →</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Step 7: Quadrant Read — per-quadrant "so what" story ─────────────────────
const QUADRANT_STORIES = {
  "brave-curious": {
    label: "THE FAST MOVER",
    headline: "You ask the question before anyone else knows it's a question.",
    body: [
      "There's a moment in every room when someone decides to go first. To say the thing. To try the approach that might not work. You're usually that person — or you're the one who sees it clearly enough that you should be.",
      "Carol Dweck spent years studying what separates people who improve from people who plateau. Her finding was simple: the learners believe ability grows. They lean toward challenges instead of away from them. That's you, right now. Brave enough to move. Curious enough to keep updating.",
      "Your risk isn't failure. Your risk is moving so fast you skip the step that would have made the next ten easier. The best version of this quadrant doesn't just move — it moves with a question in its hand.",
      "Environments that fit you: early-stage startups, innovation roles, places still figuring out the playbook. Places where \"we haven't tried that yet\" is an invitation, not a warning.",
    ],
  },
  "brave-judgmental": {
    label: "THE STANDARD HOLDER",
    headline: "You know what good looks like. That's not common.",
    body: [
      "There's a version of \"high standards\" that's just fear of being wrong. But there's another version — the one you have — where you've actually seen enough to know the difference. You've built a model of quality, and you hold it.",
      "The research on conscientiousness shows it's one of the strongest predictors of long-term career success. Not charisma. Not raw intelligence. The willingness to do the thing right, even when no one's checking.",
      "Where this gets complicated: the line between conviction and rigidity. The best standard-holders stay open to the possibility that their model of good is incomplete. Not because they're wishy-washy — because they're curious enough to update.",
      "Environments that fit you: operations, editorial, leadership, policy — anywhere that needs someone who won't fold under pressure. Watch for places that mistake loudness for confidence. You deserve rooms where substance is the currency.",
    ],
  },
  "fearful-curious": {
    label: "THE DEEP THINKER",
    headline: "You process differently. That's not a flaw.",
    body: [
      "Here's what looks like hesitation from the outside: you reading the room before you move. Noticing the thing no one else noticed. Asking the question quietly, to yourself first, before you know whether the room is safe enough for it.",
      "Amy Edmondson's research on psychological safety changed how we think about high-performing teams. Her finding: teams don't perform well because they never fail. They perform well because they're safe enough to try — and safe enough to say when something's not working.",
      "You do your best thinking in environments with that kind of safety. Not the absence of challenge — the presence of trust. You don't need easy. You need a room that rewards depth over speed.",
      "The move for you right now isn't bravery for its own sake. It's finding one environment — one mentor, one team, one role — where you can be fully visible. The output that comes after that tends to surprise people. Including you.",
    ],
  },
  "fearful-judgmental": {
    label: "FINDING FOOTING",
    headline: "Something made you careful. That's information.",
    body: [
      "Most people have been here. The cautious place. The place where you're sizing up the terrain before you commit to a direction. It doesn't mean you're behind — it means something, probably something real, taught you to be careful.",
      "Edward Deci and Richard Ryan spent decades studying what makes people actually move. Their conclusion: we need three things — some sense of autonomy, some sense of competence, and some sense of connection. When those are missing, we go quiet. We protect.",
      "The question isn't how to force yourself to be brave. The question is: what's the smallest environment where you'd feel safe enough to be honest? One person. One conversation. One low-stakes experiment. That's where this starts.",
      "You don't need a breakthrough. You need a foothold. Cove is designed for exactly this moment — to help you find the people and the context that make the next step feel possible.",
    ],
  },
};

function StepQuadrantRead({ selfPosition, next }) {
  const visible = useFadeIn([]);
  const quadrant = selfPosition ? getQuadrant(selfPosition.x, selfPosition.y) : "brave-curious";
  const qr = QUADRANT_READS[quadrant];
  const story = QUADRANT_STORIES[quadrant];

  return (
    <div style={{ ...fadeStyle(visible), padding: "80px 28px 56px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
        {/* Badge */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 20, marginBottom: 20, background: qr.color + "15", border: `1px solid ${qr.color}40` }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: qr.color }} />
          <span style={{ fontSize: 10, letterSpacing: 2, color: qr.color, fontFamily: "monospace" }}>{story.label}</span>
        </div>

        <p style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontFamily: "monospace", margin: "0 0 28px" }}>WHAT THIS MEANS</p>

        <h2 style={{ fontSize: 24, fontWeight: 400, margin: "0 0 28px", color: C.pearl, lineHeight: 1.45 }}>
          {story.headline}
        </h2>

        {story.body.map((text, i) => (
          <p key={i} style={{
            fontSize: 15,
            color: i === story.body.length - 1 ? C.text : C.muted,
            lineHeight: 1.85, margin: "0 0 20px",
          }}>{text}</p>
        ))}

      </div>

      <Btn onClick={next} style={{ marginTop: 32 }}>keep going →</Btn>
    </div>
  );
}

// ── Step 8: Ash Ketchum / Generous Enthusiasm ────────────────────────────────
function StepAshStory({ next }) {
  const visible = useFadeIn([]);
  const p = (text, extra = {}) => (
    <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, margin: "0 0 20px", ...extra }}>{text}</p>
  );
  return (
    <div style={{ ...fadeStyle(visible), padding: "80px 28px 56px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 20, marginBottom: 20, background: C.faint, border: `1px solid ${C.borderSoft}` }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.ocean }} />
          <span style={{ fontSize: 10, letterSpacing: 2, color: C.muted, fontFamily: "monospace" }}>COVE ETHOS</span>
        </div>
        <p style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontFamily: "monospace", margin: "0 0 36px" }}>GENEROUS ENTHUSIASM</p>

        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, margin: "0 0 20px" }}>
          I always come back to this one moment in <em style={{ color: C.pearl }}>Pokémon: Mewtwo Returns</em>.
        </p>

        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, margin: "0 0 20px" }}>
          Mewtwo was built in a lab, hunted, and betrayed. He trusts no one, and he's been actively trying to kill Ash's friends for the entirety of the movie. And then... when Mewtwo is moments away from death... Ash just... helps him.
        </p>

        {/* Mewtwo GIF */}
        <div style={{ margin: "0 0 24px", borderRadius: 12, overflow: "hidden", lineHeight: 0 }}>
          <img
            src="https://media.giphy.com/media/JWsWyAUZhOZxK/giphy.gif"
            alt="Mew and Mewtwo"
            style={{ width: "100%", borderRadius: 12, display: "block" }}
          />
          <p style={{ fontSize: 9, color: C.dim, margin: "6px 0 0", letterSpacing: 1, textTransform: "uppercase" }}>via GIPHY · Pokémon</p>
        </div>

        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, margin: "0 0 20px" }}>
          No calculation. No angle. Steps in like it's the most obvious thing in the world.
        </p>

        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, margin: "0 0 20px" }}>
          Mewtwo stops. Can't make sense of it. Asks why.
        </p>

        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, margin: "0 0 20px" }}>
          Ash looks back at him and says:
        </p>

        <blockquote style={{
          margin: "0 0 24px",
          padding: "20px 24px",
          borderLeft: `3px solid ${C.ocean}`,
          background: C.surface,
          borderRadius: "0 10px 10px 0",
        }}>
          <p style={{ fontSize: 18, fontWeight: 300, color: C.pearl, lineHeight: 1.55, margin: "0 0 10px", fontStyle: "italic" }}>
            "Do you always need a reason to help somebody?"
          </p>
          <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>— Ash Ketchum, Pokémon Trainer</p>
        </blockquote>

        {p("Then he keeps going.")}

        {/* Ash + Pikachu GIF */}
        <div style={{ margin: "0 0 24px", borderRadius: 12, overflow: "hidden", lineHeight: 0 }}>
          <img
            src="https://media1.tenor.com/m/cMy8rXqdR_kAAAAC/anipoke-pokemon.gif"
            alt="Ash and Pikachu"
            style={{ width: "100%", borderRadius: 12, display: "block" }}
          />
          <p style={{ fontSize: 9, color: C.dim, margin: "6px 0 0", letterSpacing: 1, textTransform: "uppercase" }}>via Tenor · Pokémon</p>
        </div>

        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, margin: "0 0 12px" }}>
          The people who move well through a job search are the ones who leave rooms better than they found them. Who build real relationships instead of a pipeline. They show up before the ask. They give before there's anything to gain.
        </p>

        <p style={{ fontSize: 15, color: C.pearl, lineHeight: 1.85, margin: "0 0 4px" }}>
          It's not a strategy. It's a posture.
        </p>
        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, margin: "0 0 48px" }}>
          And it changes everything.
        </p>
      </div>

      <Btn onClick={next}>hell yea. let's keep it moving.</Btn>
    </div>
  );
}

// ── Step 8: Brave Reflection ──────────────────────────────────────────────────
function StepBraveReflect({ next }) {
  const visible = useFadeIn([]);
  const [text, setText] = useState("");
  const ref = useRef(null);

  useEffect(() => { if (ref.current) ref.current.focus(); }, []);

  return (
    <div style={{ ...fadeStyle(visible), padding: "80px 28px 48px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontFamily: "monospace", margin: "0 0 24px" }}>BRAVE DECISIONS</p>
        <h2 style={{ fontSize: 26, fontWeight: 400, margin: "0 0 16px", color: C.pearl, lineHeight: 1.45 }}>
          What would a brave career decision look like right now?
        </h2>
        <p style={{ fontSize: 14, color: C.dim, lineHeight: 1.8, margin: "0 0 36px", fontStyle: "italic" }}>
          Not the safe answer. The one that keeps surfacing when you're quiet enough to hear it.
        </p>
        <textarea
          ref={ref}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="What would you do if you weren't afraid of the outcome?"
          style={{
            width: "100%", boxSizing: "border-box",
            background: C.surface,
            border: `1px solid ${text ? C.ocean : C.borderSoft}`,
            borderRadius: 14, padding: "22px 22px",
            fontSize: 16, color: C.text, outline: "none",
            fontFamily: "Georgia, serif", resize: "none",
            minHeight: 220, lineHeight: 1.9,
            transition: "border-color 0.3s",
          }}
        />
        <p style={{ fontSize: 11, color: C.dim, marginTop: 12, fontStyle: "italic", textAlign: "center" }}>
          take your time.
        </p>
      </div>
      <Btn onClick={() => next(text)} disabled={!text.trim()} style={{ marginTop: 24 }}>
        That's it
      </Btn>
    </div>
  );
}

// ── Step 9: Fears Reflection ──────────────────────────────────────────────────
function StepFearsReflect({ next }) {
  const visible = useFadeIn([]);
  const [text, setText] = useState("");
  const ref = useRef(null);

  useEffect(() => { if (ref.current) ref.current.focus(); }, []);

  return (
    <div style={{ ...fadeStyle(visible), padding: "80px 28px 48px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontFamily: "monospace", margin: "0 0 24px" }}>WHAT'S IN THE WAY</p>
        <h2 style={{ fontSize: 26, fontWeight: 400, margin: "0 0 16px", color: C.pearl, lineHeight: 1.45 }}>
          What's actually in the way?
        </h2>
        <p style={{ fontSize: 14, color: C.dim, lineHeight: 1.8, margin: "0 0 36px", fontStyle: "italic" }}>
          Name it. You don't have to solve it here. Just say it out loud.
        </p>
        <textarea
          ref={ref}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="The story I keep telling myself is…"
          style={{
            width: "100%", boxSizing: "border-box",
            background: C.surface,
            border: `1px solid ${text ? C.ocean : C.borderSoft}`,
            borderRadius: 14, padding: "22px 22px",
            fontSize: 16, color: C.text, outline: "none",
            fontFamily: "Georgia, serif", resize: "none",
            minHeight: 220, lineHeight: 1.9,
            transition: "border-color 0.3s",
          }}
        />
        <p style={{ fontSize: 11, color: C.dim, marginTop: 12, fontStyle: "italic", textAlign: "center" }}>
          take your time.
        </p>
      </div>
      <Btn onClick={() => next(text)} disabled={!text.trim()} style={{ marginTop: 24 }}>
        I said it
      </Btn>
    </div>
  );
}


// ── Step 19: Founder note ──────────────────────────────────────────────────────
function StepFounderNote({ next }) {
  const visible = useFadeIn([]);

  return (
    <div style={{
      ...fadeStyle(visible),
      display: "flex", flexDirection: "column",
      justifyContent: "center", alignItems: "center",
      minHeight: "100vh", padding: "64px 32px",
      textAlign: "center",
    }}>
      <div style={{ maxWidth: 320 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: C.dim, fontFamily: "monospace", margin: "0 0 32px", textTransform: "uppercase" }}>
          from the builder
        </p>

        <a
          href="https://www.linkedin.com/in/fndou/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", margin: "0 auto 24px", borderRadius: "50%", overflow: "hidden", width: 100, height: 100, border: `2px solid ${C.ocean}` }}
        >
          <img
            src="/fhiwa.jpg"
            alt="Fhiwa Ndou"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </a>

        <p style={{ fontSize: 22, fontWeight: 300, color: C.pearl, lineHeight: 1.5, margin: "0 0 28px", letterSpacing: -0.3 }}>
          it's just me.
        </p>

        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.9, margin: "0 0 20px" }}>
          Job searching sucks. So much of it is outside your control, and it quietly messes with your head until you've forgotten what it felt like to just be excited about work.
        </p>

        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.9, margin: "0 0 20px" }}>
          I still think about how excited I was to get hired at Toys R Us, 18 years ago. I had no idea what I was in for, good or bad, but I didn't care. I was curious.
        </p>

        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.9, margin: "0 0 40px" }}>
          I built this to get that feeling back. Turns out a lot of people need it.
        </p>

        <p style={{ fontSize: 12, color: C.dim, fontStyle: "italic", margin: "0 0 8px" }}>— Fhiwa Ndou</p>
        <a
          href="https://www.linkedin.com/in/fndou/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12, color: C.ocean, textDecoration: "none", display: "block", marginBottom: 40 }}
        >
          catch me on LinkedIn →
        </a>
      </div>

      <Btn onClick={next}>let's go →</Btn>
    </div>
  );
}

// ── Step Final: Share screen ───────────────────────────────────────────────────
function StepBetaForm({ name, selfPosition, finish }) {
  const visible = useFadeIn([]);
  const [copied, setCopied] = useState(false);

  const qLabel = selfPosition
    ? `${selfPosition.y < 50 ? "Brave" : "Fearful"} + ${selfPosition.x > 50 ? "Curious" : "Judgmental"}`
    : null;
  const shareUrl = "https://cove-main.vercel.app";
  const shareText = `Hey! Check out this new career app called Cove. I wanna see where you land on the matrix :) ${shareUrl}`;

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ text: shareText, url: shareUrl }); } catch {}
    } else {
      await navigator.clipboard?.writeText(`${shareText}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <Shell depth={19}>
      <div style={{ ...fadeStyle(visible), minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        {/* Kid photo */}
        <div style={{ position: "relative", height: 320, overflow: "hidden", background: "#08090c", flexShrink: 0 }}>
          <img
            src="/fhiwa-kid.jpg"
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 50%", filter: "brightness(1.2) contrast(1.08)" }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(8,9,12,0.15) 0%, transparent 30%, transparent 60%, rgba(8,9,12,0.95) 100%)" }} />
          <div style={{ position: "absolute", bottom: 20, left: 24 }}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "monospace", letterSpacing: 1, margin: "0 0 4px", fontStyle: "italic" }}>
              me, probably plotting something.
            </p>
            <p style={{ fontSize: 13, color: C.ocean, fontFamily: "monospace", letterSpacing: 1, margin: 0 }}>
              brave + curious
            </p>
          </div>
        </div>

        {/* Bottom CTA */}
        <div style={{ flex: 1, padding: "28px 24px 52px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 14, background: "#0b0f14" }}>
          <div
            onClick={finish}
            style={{
              textAlign: "center", padding: "22px 24px", cursor: "pointer",
              background: "#f0f8ff", color: "#0b1a28",
              fontSize: 18, borderRadius: 14, fontFamily: "Georgia, serif",
              letterSpacing: 0.3, touchAction: "manipulation",
            }}
          >
            check out your dashboard!
          </div>
        </div>

      </div>
    </Shell>
  );
}

// eslint-disable-next-line no-unused-vars
function _StepBetaFormOld_unused({ name, selfPosition, contacts, finish }) {
}

function StepDone({ name, finish }) {
  const visible = useFadeIn([]);
  return (
    <div style={{ ...fadeStyle(visible), display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", padding: "48px 32px", textAlign: "center" }}>
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 48, marginBottom: 24 }}>💙</div>
        <h2 style={{ fontSize: 28, fontWeight: 400, margin: "0 0 16px", color: C.pearl, lineHeight: 1.3 }}>
          Alright, {name}. You're in.
        </h2>
        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.8, margin: 0 }}>
          You know where you sit. You know what you need. You know who you want to reach. Now go be generous with it.
        </p>
      </div>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <Btn onClick={finish}>Open Cove</Btn>
      </div>
      <p style={{ fontSize: 11, color: C.dim, marginTop: 24, fontStyle: "italic" }}>
        "the karma compounds quietly."
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════

function MainApp({ userData, update, tab, setTab, activeContact, setActiveContact, onReset }) {
  const openContact = (c) => { setActiveContact(c); setTab("contact"); };
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(userData.name || "");

  const saveName = () => {
    if (nameInput.trim()) update({ name: nameInput.trim() });
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

        {/* Content */}
        <div style={{ flex: 1, height: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 16 }}>
          {tab === "home"      && <HomeTab      userData={userData} openContact={openContact} setTab={setTab} />}
          {tab === "contact"   && activeContact && <ContactTab contact={activeContact} />}
          {tab === "values"    && <ValuesTab    wants={userData.wants} />}
          {tab === "matrix"    && <MatrixTab    contacts={userData.contacts} openContact={openContact} selfPosition={userData.selfPosition} name={userData.name} />}
          {tab === "vibes"     && <VibesTab />}
          {tab === "list"      && <List100Tab userData={userData} />}
          {tab === "you"       && <ProfileTab   userData={userData} onReset={onReset} />}
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
            { id: "home",   label: "Home",   icon: "⌂" },
            { id: "matrix", label: "Matrix", icon: "⊹" },
            { id: "list",   label: "List",   icon: "≡" },
            { id: "vibes",  label: "Vibes",  icon: "〰" },
            { id: "you",    label: "You",    icon: "◉" },
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
const HOME_QUOTES = [
  { text: "The karma compounds quietly.", attr: null },
  { text: "Do you always need a reason to help somebody?", attr: "— Ash Ketchum" },
  { text: "Careers over cash. The right fit pays you back in ways money can't count.", attr: null },
  { text: "Go-Giver first. Show up with something to offer.", attr: null },
  { text: "Where you start is not where you have to stay.", attr: null },
  { text: "The brave career decision is rarely the comfortable one.", attr: null },
  { text: "Your energy is finite. Spend it on people who multiply it.", attr: null },
  { text: "Generous enthusiasm is a superpower.", attr: null },
];

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

      {/* Greeting */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 400, margin: "0 0 8px", color: C.pearl, letterSpacing: -0.3 }}>
          {firstName ? `Hey, ${firstName}.` : "Welcome back."}
        </h1>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.85, margin: 0 }}>
          {TAGLINE}
        </p>
      </div>

      {/* Matrix position widget */}
      {qr && userData.selfPosition && (
        <div style={{ marginBottom: 28 }}>
          <SectionLabel>where you are</SectionLabel>
          <div style={{
            padding: "16px", borderRadius: 12,
            background: C.surface, border: `1px solid ${C.borderSoft}`,
            display: "flex", gap: 14, alignItems: "center",
          }}>
            {/* Mini matrix */}
            <div style={{
              width: 60, height: 60, flexShrink: 0,
              position: "relative",
              background: C.raised, borderRadius: 8,
              border: `1px solid ${C.border}`, overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: C.border }} />
              <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: C.border }} />
              {/* Self dot */}
              <div style={{
                position: "absolute",
                left: `${userData.selfPosition.x}%`,
                top: `${userData.selfPosition.y}%`,
                transform: "translate(-50%,-50%)",
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: qr.color,
                  boxShadow: `0 0 6px ${qr.color}80`,
                }} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: qr.color, fontFamily: "monospace", letterSpacing: 1, marginBottom: 4 }}>
                {qr.title.toUpperCase()}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.7 }}>{qr.short}</p>
            </div>
          </div>
        </div>
      )}

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
    Legacy:    "You want to matter beyond the role. That's not ego, that's integrity. The work that earns Legacy is work where you can say 'I built that' and mean it in a way that has nothing to do with your title.",
    Curiosity: "You need a problem worth losing yourself in. If you can't see yourself still curious about the work in year two, that's a signal. It never gets more interesting only more familiar.",
    Stability: "This isn't playing it safe. It's building a floor solid enough that you can take the risks that actually count. Know your number. Don't go below it.",
    Joy:       "You've tried the joyless version. It doesn't work. Joy isn't a nice-to-have. It's the difference between your best self showing up and a functional version of you showing up. Not the same thing.",
    Access:    "You've earned the right to want a real seat. Not a courtesy invite. Actual influence. The rooms where decisions happen are the rooms you belong in. Hold out for that.",
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
              fontSize: 14, fontWeight: 700, color: "#e0eef8",
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

// ── Vibes Tab ─────────────────────────────────────────────────────────────────
function VibesTab() {
  const visible = useFadeIn(["vibes"]);
  const cards = [
    { emoji: "🐸", text: "it's time to try defying gravity" },
    { emoji: "🦥", text: "slow rider. still riding." },
    { emoji: "💙", text: "what a privilege it is to see progress, even if no one else does" },
    { emoji: "🐺", text: "good morning stackmates" },
    { emoji: "〰️", text: "no problem.........." },
    { emoji: "🌊", text: "a real person makes their own luck" },
  ];

  return (
    <div style={{ ...fadeStyle(visible) }}>

      {/* Water image header */}
      <div style={{ position: "relative", height: 200, overflow: "hidden" }}>
        <img
          src="/water.jpg"
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, transparent 30%, #0b0f14 100%)",
        }} />
        <div style={{
          position: "absolute", bottom: 16, left: 22,
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 400, margin: 0, color: C.pearl }}>Vibes</h2>
        </div>
      </div>

      <div style={{ padding: "16px 22px 28px" }}>
      <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: "0 0 24px" }}>
        The job search is a long game. Keep something here that reminds you why you're even playing.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
        {cards.map((card, i) => (
          <div key={i} style={{
            padding: "20px 16px", borderRadius: 12,
            background: C.surface, border: `1px solid ${C.borderSoft}`,
            display: "flex", flexDirection: "column",
            alignItems: "center", textAlign: "center", gap: 10,
            minHeight: 100,
          }}>
            <div style={{ fontSize: 26 }}>{card.emoji}</div>
            <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic", lineHeight: 1.6 }}>{card.text}</div>
          </div>
        ))}
        <div style={{
          padding: "20px 16px", borderRadius: 12, minHeight: 100,
          border: `1px dashed ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: C.dim, fontSize: 12, cursor: "pointer",
        }}>+ add yours</div>
      </div>

      <div style={{
        padding: "18px 20px", borderRadius: 12,
        background: C.surface, border: `1px solid ${C.borderSoft}`,
        borderLeft: `2px solid ${C.oceanDeep}`,
      }}>
        <SectionLabel>the move</SectionLabel>
        <p style={{ margin: 0, fontSize: 13, color: C.muted, fontStyle: "italic", lineHeight: 1.9 }}>
          You're not desperate. You're selective. Show up like someone who's been places and is genuinely excited about where they're going next. That energy is not fake it's what gets you in the room.
        </p>
      </div>
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

function List100Tab({ userData }) {
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

  const [view, setView]         = useState("cards");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);
  const [form, setForm]         = useState(makeEntry());
  const [toast, setToast]       = useState(null);
  const toastTimer              = useRef(null);

  const save = (next) => {
    setEntries(next);
    localStorage.setItem("cove_list100", JSON.stringify(next));
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
    width: "100%", background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: "10px 12px", fontSize: 13,
    color: C.text, outline: "none", fontFamily: "Georgia, serif",
    boxSizing: "border-box",
  };

  // ── Entry card ────────────────────────────────────────────────────────────
  const EntryCard = ({ e }) => {
    const fullName = `${e.firstName} ${e.lastName}`.trim();
    const a1Color  = ATTEMPT_COLORS[e.attempt1] || C.dim;
    const a2Color  = ATTEMPT_COLORS[e.attempt2] || C.dim;
    return (
      <div style={{
        background: C.surface, borderRadius: 12,
        border: `1px solid ${C.borderSoft}`,
        borderLeft: `3px solid ${e.warm === "warm" ? "#c47020" : C.border}`,
        padding: "14px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 15, color: C.pearl, fontWeight: 500 }}>{fullName || "—"}</div>
            {e.company && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{e.company}</div>}
          </div>
          <div style={{ display: "flex", gap: 12, flexShrink: 0, marginLeft: 12 }}>
            <span onClick={() => openEdit(e)} style={{ fontSize: 11, color: C.muted, cursor: "pointer", fontFamily: "monospace" }}>edit</span>
            <span onClick={() => deleteEntry(e.id)} style={{ fontSize: 13, color: C.dim, cursor: "pointer" }}>✕</span>
          </div>
        </div>
        {e.why && (
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 3, lineHeight: 1.6 }}>
            <span style={{ color: C.dim, fontFamily: "monospace", fontSize: 9, marginRight: 6, letterSpacing: 1 }}>WHY</span>{e.why}
          </div>
        )}
        {e.ask && (
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, lineHeight: 1.6 }}>
            <span style={{ color: C.dim, fontFamily: "monospace", fontSize: 9, marginRight: 6, letterSpacing: 1 }}>ASK</span>{e.ask}
          </div>
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{
            fontSize: 10, fontFamily: "monospace", padding: "3px 8px", borderRadius: 20,
            background: e.warm === "warm" ? "#c4702018" : `${C.ocean}10`,
            color: e.warm === "warm" ? "#c47020" : C.muted,
            border: `1px solid ${e.warm === "warm" ? "#c4702030" : C.border}`,
          }}>
            {e.warm === "warm" ? "🔥 warm" : "❄️ cold"}
          </span>
          <span onClick={() => cycleAttempt(e.id, "attempt1")} title="click to cycle" style={{
            fontSize: 10, fontFamily: "monospace", padding: "3px 8px", borderRadius: 20, cursor: "pointer",
            background: e.attempt1 && e.attempt1 !== "—" ? `${a1Color}15` : "transparent",
            color: e.attempt1 && e.attempt1 !== "—" ? a1Color : C.dim,
            border: `1px solid ${e.attempt1 && e.attempt1 !== "—" ? a1Color + "50" : C.border}`,
          }}>
            {e.attempt1 && e.attempt1 !== "—" ? `A1: ${e.attempt1}` : "A1 —"}
          </span>
          <span onClick={() => cycleAttempt(e.id, "attempt2")} title="click to cycle" style={{
            fontSize: 10, fontFamily: "monospace", padding: "3px 8px", borderRadius: 20, cursor: "pointer",
            background: e.attempt2 && e.attempt2 !== "—" ? `${a2Color}15` : "transparent",
            color: e.attempt2 && e.attempt2 !== "—" ? a2Color : C.dim,
            border: `1px solid ${e.attempt2 && e.attempt2 !== "—" ? a2Color + "50" : C.border}`,
          }}>
            {e.attempt2 && e.attempt2 !== "—" ? `A2: ${e.attempt2}` : "A2 —"}
          </span>
          {e.linkedin && (
            <a href={e.linkedin.startsWith("http") ? e.linkedin : `https://${e.linkedin}`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 10, color: C.tide, fontFamily: "monospace", textDecoration: "none" }}>in ↗</a>
          )}
        </div>
        {e.notes && <div style={{ fontSize: 11, color: C.dim, fontStyle: "italic", marginTop: 8, lineHeight: 1.6 }}>{e.notes}</div>}
        <div style={{ fontSize: 9, color: C.dim, fontFamily: "monospace", marginTop: 6, opacity: 0.5 }}>{e.added}</div>
      </div>
    );
  };

  // ── Table row ─────────────────────────────────────────────────────────────
  const TableRow = ({ e, i }) => {
    const fullName = `${e.firstName} ${e.lastName}`.trim();
    const a1Color  = ATTEMPT_COLORS[e.attempt1] || C.dim;
    const a2Color  = ATTEMPT_COLORS[e.attempt2] || C.dim;
    return (
      <div style={{
        display: "grid", gridTemplateColumns: "28px 1fr 80px 56px 56px 32px",
        gap: 8, alignItems: "center",
        padding: "9px 0", borderBottom: `1px solid ${C.borderSoft}`,
      }}>
        <span style={{ color: C.dim, fontFamily: "monospace", fontSize: 10 }}>{i + 1}</span>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 13, color: C.text }}>{fullName || "—"}</span>
          {e.company && <span style={{ fontSize: 11, color: C.dim, marginLeft: 8 }}>{e.company}</span>}
        </div>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: e.warm === "warm" ? "#c47020" : C.muted }}>
          {e.warm === "warm" ? "🔥 warm" : "❄️ cold"}
        </span>
        <span onClick={() => cycleAttempt(e.id, "attempt1")} style={{
          fontSize: 10, fontFamily: "monospace", cursor: "pointer",
          color: e.attempt1 && e.attempt1 !== "—" ? a1Color : C.dim,
        }}>
          {e.attempt1 && e.attempt1 !== "—" ? e.attempt1 : "—"}
        </span>
        <span onClick={() => cycleAttempt(e.id, "attempt2")} style={{
          fontSize: 10, fontFamily: "monospace", cursor: "pointer",
          color: e.attempt2 && e.attempt2 !== "—" ? a2Color : C.dim,
        }}>
          {e.attempt2 && e.attempt2 !== "—" ? e.attempt2 : "—"}
        </span>
        <span onClick={() => openEdit(e)} style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", cursor: "pointer" }}>edit</span>
      </div>
    );
  };

  // ── Add / Edit form (bottom sheet) ────────────────────────────────────────
  const EntryForm = () => (
    <div style={{
      position: "fixed", inset: 0, background: "#000000cc",
      zIndex: 200, display: "flex", alignItems: "flex-end",
    }} onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
      <div style={{
        width: "100%", maxHeight: "88vh", overflowY: "auto",
        background: C.surface, borderRadius: "20px 20px 0 0",
        padding: "24px 20px 44px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: 2, color: C.muted }}>
            {editId ? "EDIT CONTACT" : "ADD CONTACT"}
          </span>
          <span onClick={() => setShowForm(false)} style={{ color: C.muted, cursor: "pointer", fontSize: 18 }}>✕</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
            placeholder="First name" style={inputStyle} />
          <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
            placeholder="Last name" style={inputStyle} />
        </div>
        <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
          placeholder="Company / Organization" style={{ ...inputStyle, marginBottom: 8 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="Email" style={inputStyle} />
          <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="Phone" style={inputStyle} />
        </div>
        <input value={form.linkedin} onChange={e => setForm(f => ({ ...f, linkedin: e.target.value }))}
          placeholder="LinkedIn URL" style={{ ...inputStyle, marginBottom: 8 }} />
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
              border: `1px solid ${form.warm === p.val ? (p.val === "warm" ? "#c47020" : C.ocean) : C.border}`,
              background: form.warm === p.val ? (p.val === "warm" ? "#c4702015" : `${C.ocean}15`) : "transparent",
              color: form.warm === p.val ? (p.val === "warm" ? "#c47020" : C.ocean) : C.muted,
            }}>{p.label}</div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {[{ field: "attempt1", label: "ATTEMPT 1" }, { field: "attempt2", label: "ATTEMPT 2" }].map(({ field, label }) => (
            <div key={field}>
              <div style={{ fontSize: 9, color: C.dim, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {ATTEMPT_STATUSES.map(s => (
                  <div key={s} onClick={() => setForm(f => ({ ...f, [field]: s }))} style={{
                    padding: "4px 9px", borderRadius: 20, cursor: "pointer", fontSize: 11, fontFamily: "monospace",
                    border: `1px solid ${form[field] === s ? (ATTEMPT_COLORS[s] || C.muted) + "80" : C.border}`,
                    background: form[field] === s ? `${ATTEMPT_COLORS[s] || C.muted}15` : "transparent",
                    color: form[field] === s ? (ATTEMPT_COLORS[s] || C.muted) : C.dim,
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
  );

  return (
    <div style={{ padding: "24px 20px 0" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <SectionLabel>list of 100</SectionLabel>
          <div style={{ fontSize: 20, color: C.pearl, fontWeight: 400 }}>Your target list</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 24, color: C.ocean, fontWeight: 400 }}>
            {entries.length}<span style={{ fontSize: 13, color: C.muted }}>/100</span>
          </div>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>
            {warm} warm · {reached} reached
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: C.borderSoft, borderRadius: 4, marginBottom: 20, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: `linear-gradient(90deg, ${C.oceanDeep}, ${C.ocean})`,
          borderRadius: 4, transition: "width 0.4s ease",
        }} />
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center" }}>
        <div onClick={openAdd} style={{
          flex: 1, display: "flex", alignItems: "center", gap: 8,
          padding: "11px 16px", borderRadius: 10,
          border: `1px dashed ${C.ocean}60`, cursor: "pointer",
          color: C.ocean, fontSize: 13,
        }}>
          <span style={{ fontSize: 16 }}>+</span> add contact
        </div>
        <div style={{ display: "flex", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          {[{ v: "cards", icon: "⊞" }, { v: "table", icon: "≡" }].map(({ v, icon }) => (
            <div key={v} onClick={() => setView(v)} style={{
              padding: "8px 13px", cursor: "pointer", fontSize: 14,
              background: view === v ? C.raised : "transparent",
              color: view === v ? C.ocean : C.muted,
            }}>{icon}</div>
          ))}
        </div>
        {entries.length > 0 && (
          <div onClick={exportCSV} style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", cursor: "pointer", padding: "8px 10px" }} title="export csv">⬇</div>
        )}
      </div>

      {/* Empty state */}
      {entries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "56px 0 32px" }}>
          <div style={{ fontSize: 36, marginBottom: 16, opacity: 0.4 }}>◉</div>
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 6 }}>your list is empty</div>
          <div style={{ fontSize: 12, color: C.dim }}>add the people you want in your corner</div>
        </div>
      ) : view === "cards" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 32 }}>
          {entries.map(e => <EntryCard key={e.id} e={e} />)}
        </div>
      ) : (
        <div style={{ paddingBottom: 32 }}>
          <div style={{
            display: "grid", gridTemplateColumns: "28px 1fr 80px 56px 56px 32px",
            gap: 8, padding: "0 0 8px", borderBottom: `1px solid ${C.border}`,
          }}>
            {["#", "NAME", "LEAD", "A1", "A2", ""].map((h, i) => (
              <span key={i} style={{ fontSize: 9, color: C.dim, fontFamily: "monospace", letterSpacing: 1 }}>{h}</span>
            ))}
          </div>
          {entries.map((e, i) => <TableRow key={e.id} e={e} i={i} />)}
        </div>
      )}

      {showForm && <EntryForm />}

      {toast && (
        <div style={{
          position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
          background: C.raised, border: `1px solid ${C.border}`, color: C.pearl,
          padding: "10px 20px", borderRadius: 8, fontSize: 13, fontFamily: "Georgia, serif",
          zIndex: 999, whiteSpace: "nowrap",
        }}>{toast}</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COACH DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

const COACH_PASSWORD = process.env.REACT_APP_COACH_PASSWORD || "cove2026";

function CoachDashboard() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [reflections, setReflections] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    if (pw === COACH_PASSWORD) {
      setAuthed(true);
      setPwError(false);
      setLoading(true);
      supabase
        .from("reflections")
        .select("id, name, quadrant, brave_reflection, fears_reflection, created_at")
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (!error && data) setReflections(data);
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

  const mono = { fontFamily: "monospace" };

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

  // Compute stats once data is loaded
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

  return (
    <div style={{
      background: C.bg, minHeight: "100vh", color: C.text,
      fontFamily: "Georgia, serif", padding: "40px 28px 80px",
      maxWidth: 680, margin: "0 auto",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
        <div>
          <div style={{ ...mono, fontSize: 11, color: C.muted, letterSpacing: 3, marginBottom: 8 }}>COVE / COACH VIEW</div>
          <h1 style={{ fontSize: 24, fontWeight: 400, color: C.pearl, margin: 0 }}>Dashboard</h1>
        </div>
        <button
          onClick={goBack}
          style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", ...mono, padding: 0, paddingTop: 4 }}
        >
          back to app
        </button>
      </div>

      {loading && (
        <div style={{ ...mono, fontSize: 12, color: C.dim, letterSpacing: 1 }}>loading...</div>
      )}

      {!loading && reflections && (
        <>
          {/* Summary cards */}
          <div style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap" }}>
            <div style={{
              flex: "1 1 140px", background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 12, padding: "20px 22px",
            }}>
              <div style={{ ...mono, fontSize: 10, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>total users</div>
              <div style={{ fontSize: 32, color: C.pearl, fontWeight: 400 }}>{total}</div>
            </div>
            {quadrantRows.map(qr => (
              <div key={qr.title} style={{
                flex: "1 1 140px", background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: "20px 22px",
                borderLeft: `3px solid ${qr.color}`,
              }}>
                <div style={{ ...mono, fontSize: 10, color: qr.color, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                  {qr.title}
                </div>
                <div style={{ fontSize: 28, color: C.pearl, fontWeight: 400 }}>{qr.count}</div>
                <div style={{ ...mono, fontSize: 11, color: C.muted, marginTop: 4 }}>{qr.pct}% of total</div>
              </div>
            ))}
          </div>

          {/* Recent entries */}
          <div>
            <div style={{ ...mono, fontSize: 9, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>
              recent entries ({total})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {reflections.map(r => {
                const key = Object.keys(QUADRANT_READS).find(k => QUADRANT_READS[k].title === r.quadrant);
                const color = key ? QUADRANT_READS[key].color : C.muted;
                const date = r.created_at ? new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
                return (
                  <div key={r.id} style={{
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderLeft: `3px solid ${color}`,
                    borderRadius: 10, padding: "16px 18px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, color: C.pearl, fontWeight: 500 }}>{r.name || "Anonymous"}</span>
                        <span style={{ ...mono, fontSize: 10, color, letterSpacing: 0.5 }}>{r.quadrant || "Unknown"}</span>
                      </div>
                      <span style={{ ...mono, fontSize: 10, color: C.dim }}>{date}</span>
                    </div>
                    {r.brave_reflection && (
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ ...mono, fontSize: 9, color: C.seafoam, letterSpacing: 1, textTransform: "uppercase" }}>brave: </span>
                        <span style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>
                          {r.brave_reflection.length > 80 ? r.brave_reflection.slice(0, 80) + "..." : r.brave_reflection}
                        </span>
                      </div>
                    )}
                    {r.fears_reflection && (
                      <div>
                        <span style={{ ...mono, fontSize: 9, color: C.ocean, letterSpacing: 1, textTransform: "uppercase" }}>fears: </span>
                        <span style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>
                          {r.fears_reflection.length > 80 ? r.fears_reflection.slice(0, 80) + "..." : r.fears_reflection}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════

function Shell({ children, depth }) {
  const d = depth != null ? getDepthPalette(depth) : null;
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

function Avatar({ name, size = 36, glow = false }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `linear-gradient(150deg, ${C.oceanDeep}, ${C.tide})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 600, color: "#e0eef8",
      boxShadow: glow ? `0 0 24px ${C.ocean}40` : "none",
    }}>{name[0]}</div>
  );
}

function Btn({ children, onClick, disabled, style }) {
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
function ProfileTab({ userData, onReset }) {
  const visible = useFadeIn(["you"]);
  const quadrant = userData.selfPosition ? getQuadrant(userData.selfPosition.x, userData.selfPosition.y) : null;
  const qr = quadrant ? QUADRANT_READS[quadrant] : null;
  const [confirming, setConfirming] = useState(false);

  const row = (label, value) => value ? (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 9, letterSpacing: 2, color: C.muted, fontFamily: "monospace", margin: "0 0 5px" }}>{label}</p>
      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.7, margin: 0 }}>{value}</p>
    </div>
  ) : null;

  return (
    <div style={{ ...fadeStyle(visible), padding: "28px 24px 40px" }}>

      {/* Identity */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ width: 52, height: 52, borderRadius: 26, background: C.ocean + "22", border: `1.5px solid ${C.ocean}40`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 22, color: C.ocean }}>◉</span>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 300, color: C.pearl, margin: "0 0 4px" }}>{userData.name || "—"}</h2>
        <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{userData.email || "no email saved"}</p>
      </div>

      {/* Matrix */}
      {qr && (
        <div style={{ padding: "18px 20px", borderRadius: 14, background: C.surface, border: `1px solid ${qr.color}40`, borderLeft: `3px solid ${qr.color}`, marginBottom: 20 }}>
          <p style={{ fontSize: 9, letterSpacing: 2, color: C.muted, fontFamily: "monospace", margin: "0 0 6px" }}>YOUR MATRIX</p>
          <p style={{ fontSize: 16, fontWeight: 400, color: qr.color, margin: "0 0 6px" }}>{qr.title}</p>
          <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: 0 }}>{qr.short}</p>
        </div>
      )}

      {/* Reflections */}
      {(userData.braveReflection || userData.fearsReflection) && (
        <div style={{ padding: "18px 20px", borderRadius: 14, background: C.surface, border: `1px solid ${C.borderSoft}`, marginBottom: 20 }}>
          <p style={{ fontSize: 9, letterSpacing: 2, color: C.muted, fontFamily: "monospace", margin: "0 0 16px" }}>YOUR REFLECTIONS</p>
          {row("THE BRAVE THING", userData.braveReflection)}
          {row("WHAT'S IN THE WAY", userData.fearsReflection)}
        </div>
      )}

      {/* List */}
      {userData.contacts?.length > 0 && (
        <div style={{ padding: "18px 20px", borderRadius: 14, background: C.surface, border: `1px solid ${C.borderSoft}`, marginBottom: 20 }}>
          <p style={{ fontSize: 9, letterSpacing: 2, color: C.muted, fontFamily: "monospace", margin: "0 0 14px" }}>YOUR LIST ({userData.contacts.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {userData.contacts.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", minWidth: 18 }}>{i + 1}</span>
                <span style={{ fontSize: 14, color: C.text }}>{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* About Cove */}
      <div style={{
        borderRadius: 14, marginBottom: 20, overflow: "hidden",
        background: C.surface, border: `1px solid ${C.borderSoft}`,
      }}>
        <div style={{ padding: "18px 18px 6px", display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: C.raised, border: `1.5px solid ${C.border}` }}>
            <img
              src="/fhiwa.jpg"
              alt="Fhiwa"
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
              onError={e => { e.target.style.display = "none"; }}
            />
          </div>
          <div>
            <p style={{ fontSize: 9, letterSpacing: 2, color: C.dim, textTransform: "uppercase", margin: "0 0 3px", fontFamily: "monospace" }}>built by</p>
            <p style={{ fontSize: 14, color: C.pearl, margin: 0, fontWeight: 400 }}>Fhiwa Ndou</p>
          </div>
        </div>
        <div style={{ padding: "10px 18px 18px" }}>
          <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.75, margin: "0 0 14px" }}>
            Cove is free and open-source. It shouldn't cost a ton of money just to get started. You don't always need a reason to help somebody.
          </p>
          <a
            href="https://github.com/chieffhiwa/cove/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block", padding: "10px 14px", borderRadius: 10, textAlign: "center",
              background: C.ocean + "18", border: `1px solid ${C.ocean}40`,
              color: C.ocean, fontSize: 12, textDecoration: "none",
              touchAction: "manipulation",
            }}
          >Get involved on GitHub →</a>
        </div>
      </div>

      {/* Reset */}
      <div style={{ marginTop: 0 }}>
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            style={{ background: "none", border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: "12px 20px", color: C.muted, fontSize: 12, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1, width: "100%" }}
          >
            start over / redo onboarding
          </button>
        ) : (
          <div style={{ padding: "16px 20px", borderRadius: 12, background: C.surface, border: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 13, color: C.muted, margin: "0 0 14px", lineHeight: 1.7 }}>This will clear your local data and restart the flow. Your Supabase record stays intact.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirming(false)} style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px", color: C.muted, fontSize: 12, cursor: "pointer" }}>cancel</button>
              <button onClick={onReset} style={{ flex: 1, background: "#e07070", border: "none", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>yes, start over</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function fadeStyle(visible) {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(8px)",
    transition: "opacity 0.18s ease, transform 0.18s ease",
    willChange: "opacity, transform",
  };
}
