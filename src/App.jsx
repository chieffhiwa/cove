import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

// ─── DISCORD WEBHOOK ─────────────────────────────────────────────────────────
const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1477427861706117265/mewcLc9XgpBYM10AiQQl3lpY016KvrmI1sc897YD2yYQJL78TTqVu73lbDrsHbrgwK5i";

function postReflections({ name, selfPosition, braveReflection, fearsReflection }) {
  const quadrant = selfPosition ? getQuadrant(selfPosition.x, selfPosition.y) : null;
  const quadrantLabel = quadrant ? QUADRANT_READS[quadrant]?.title : "Unknown";

  // Save to Supabase
  supabase.from("reflections").insert({
    name: name || null,
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
          { name: "💙 Brave decision", value: braveReflection || "_(no response)_" },
          { name: "🌊 What's in the way", value: fearsReflection || "_(no response)_" },
        ],
        footer: { text: "cove · your career, your current." },
        timestamp: new Date().toISOString(),
      }],
    }),
  }).catch(() => {}); // fire and forget — don't block the user
}

// ─── PALETTE ────────────────────────────────────────────────────────────────
const C = {
  bg:         "#0b0f14",
  surface:    "#0f1520",
  raised:     "#131c28",
  border:     "#1a2535",
  borderSoft: "#141e2c",
  text:       "#c2cfe0",
  muted:      "#4d6480",
  faint:      "#1e2d40",
  dim:        "#253447",
  ocean:      "#4a9eca",
  oceanDeep:  "#2a6a9a",
  seafoam:    "#5ec4b0",
  sky:        "#7ab8d8",
  mist:       "#9cb8cc",
  tide:       "#3d7fa8",
  pearl:      "#b8ccd8",
};

// ─── FEELING DEFINITIONS ─────────────────────────────────────────────────────
const FEELINGS = [
  { id: "Freedom",   color: C.ocean,    desc: "Autonomy over time, place, and how you work" },
  { id: "Legacy",    color: C.seafoam,  desc: "Meaning that outlasts the role" },
  { id: "Curiosity", color: C.sky,      desc: "Problems worth losing yourself in" },
  { id: "Stability", color: C.mist,     desc: "A floor you can build from" },
  { id: "Joy",       color: C.pearl,    desc: "People and work that light something up" },
  { id: "Access",    color: C.tide,     desc: "A seat where decisions actually happen" },
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

// ─── FADE-IN HOOK ─────────────────────────────────────────────────────────────
function useFadeIn(deps = []) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 40);
    return () => clearTimeout(t);
  }, deps);
  return visible;
}

// ─── ROOT ────────────────────────────────────────────────────────────────────
const DEFAULT_USER_DATA = {
  name: "",
  email: "",
  selfPosition: null,
  braveReflection: "",
  fearsReflection: "",
  wants: [],
  contacts: [],
};

export default function App() {
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
        finish={() => setPhase("main")}
      />
    );
  }

  return (
    <MainApp
      userData={userData}
      update={update}
      tab={mainTab}
      setTab={setMainTab}
      activeContact={activeContact}
      setActiveContact={setActiveContact}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONBOARDING
// ═══════════════════════════════════════════════════════════════════════════════

function Onboard({ step, setStep, userData, update, finish }) {
  const steps = [
    <StepWelcome        key={0} next={() => setStep(1)} />,
    <StepPrivacy        key={1} next={() => setStep(2)} />,
    <StepPhilosophy     key={2} next={() => setStep(3)} />,
    <StepName           key={3} next={(name) => { update({ name }); setStep(4); }} />,
    <StepSelfMatrix     key={4} name={userData.name} initialPosition={userData.selfPosition} next={(selfPosition) => { update({ selfPosition }); setStep(5); }} />,
    <StepMatrixPause    key={5} selfPosition={userData.selfPosition} next={() => setStep(6)} goBack={() => setStep(4)} />,
    <StepAshStory       key={6} next={() => setStep(7)} />,
    <StepBraveReflect   key={7} next={(braveReflection) => { update({ braveReflection }); setStep(8); }} />,
    <StepFearsReflect   key={8} next={(fearsReflection) => { update({ fearsReflection }); setStep(9); postReflections({ ...userData, fearsReflection }); }} />,
    <StepPause          key={9} finish={() => setStep(10)} />,
    <StepPricing        key={10} next={(email) => { if (email) update({ email }); finish(); }} />,
  ];

  // Dots on steps 2–4 (philosophy, name, matrix) and 7–8 (brave, fears). Hide on 0,1,5,6,9,10.
  const showDots = [2,3,4,7,8].includes(step);
  const dotStep = step <= 4 ? step - 1 : step - 4;

  return (
    <Shell>
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
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 13, letterSpacing: 6, color: C.muted, fontFamily: "monospace", marginBottom: 24 }}>
          C O V E
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 400, margin: "0 0 20px", color: C.pearl, lineHeight: 1.3, letterSpacing: -0.5 }}>
          Find work that<br />actually fits.
        </h1>
        <p style={{ fontSize: 11, letterSpacing: 4, color: C.muted, fontFamily: "monospace", margin: "0 0 20px", textTransform: "uppercase" }}>
          A simple, proven system.
        </p>
        <p style={{ fontSize: 11, letterSpacing: 3, color: C.ocean, fontFamily: "monospace", margin: 0, textTransform: "lowercase" }}>
          your career. your current.
        </p>
      </div>

      <div style={{ width: "100%", maxWidth: 320 }}>
        <Btn onClick={next}>Begin</Btn>
      </div>

      <p style={{ fontSize: 11, color: C.dim, marginTop: 28, fontStyle: "italic" }}>
        takes about 5 minutes
      </p>
    </div>
  );
}

// ── Step 1: Privacy ───────────────────────────────────────────────────────────
function StepPrivacy({ next }) {
  const visible = useFadeIn([]);
  const commitments = [
    { icon: "🔒", title: "Your data stays yours", body: "Everything you share in Cove — your reflections, your matrix position, your thoughts — belongs to you. We don't sell it, share it, or use it for anything other than making your experience better." },
    { icon: "👁️", title: "No surveillance, no profiling", body: "We're not building an ad business. We're building a career tool. We have zero interest in tracking you across the web or building a profile to sell to anyone." },
    { icon: "💙", title: "A personal commitment", body: "This community works for you, or it doesn't work at all. If you ever feel like we've broken that trust, tell us. We mean it." },
  ];

  return (
    <div style={{ ...fadeStyle(visible), padding: "72px 28px 48px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontFamily: "monospace", margin: "0 0 16px" }}>BEFORE WE START</p>
        <h2 style={{ fontSize: 26, fontWeight: 400, margin: "0 0 10px", color: C.pearl, lineHeight: 1.35 }}>
          We don't touch your data.
        </h2>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.8, margin: "0 0 28px" }}>
          Your reflections are personal. We treat them that way.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {commitments.map((c, i) => (
            <div key={i} style={{
              padding: "18px 20px", borderRadius: 12,
              background: C.surface, border: `1px solid ${C.borderSoft}`,
              display: "flex", gap: 14, alignItems: "flex-start",
            }}>
              <span style={{ fontSize: 20, lineHeight: 1, marginTop: 2 }}>{c.icon}</span>
              <div>
                <div style={{ fontSize: 13, color: C.pearl, fontWeight: 500, marginBottom: 5 }}>{c.title}</div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.75 }}>{c.body}</div>
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
    if (sbError) { setError("something went wrong — try again"); return; }
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
            "If it's not for you — full refund.",
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
              ✓ Check your inbox — we sent you a link.
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
    { icon: "💙", title: "\u201cGo-Giver\u201d first", body: "It's about what you have to offer — not what you have to gain. This shift in thinking changes everything. Lead with the gift, and show up like you mean it.", cite: "The Go-Giver — Bob Burg & John David Mann" },
    { icon: "〰️", title: "Careers over cash", body: "Get the stars out of your eyes. We all know someone who took the higher offer and immediately regretted it. The opportunity you feel — in your gut — like you need to explore? That's often the one that changes your life. You already know which one you want." },
    { icon: "🐸", title: "Generous enthusiasm", body: "The energy you bring into a room is part of the pitch. Showing up with something to give — before there's anything to gain — is the edge most people leave on the table." },
  ];

  return (
    <div style={{ ...fadeStyle(visible), padding: "72px 28px 48px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontFamily: "monospace", marginBottom: 20 }}>HOW THIS WORKS</p>
        <h2 style={{ fontSize: 26, fontWeight: 400, margin: "0 0 32px", color: C.pearl, lineHeight: 1.35 }}>
          Three things.
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
                  <div style={{ fontSize: 10, color: C.dim, fontStyle: "italic", marginTop: 8 }}>{p.cite}</div>
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
          First though, who are you?
        </h2>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, margin: "0 0 36px" }}>
          First name only. This whole thing is for you.
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

// ── Step 3: Self Matrix ───────────────────────────────────────────────────────
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
              Move your dot. This is about how you actually see yourself right now — not how you want to be seen, not who you're becoming. Just honest. Where are you today?
            </p>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 24, fontWeight: 400, margin: "0 0 8px", color: C.pearl, lineHeight: 1.35 }}>
              Be real with yourself, {name}.
            </h2>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: "0 0 22px" }}>
              Brave or fearful? Curious or judgmental? Be honest — not aspirational. Where you actually are, not where you want to be.
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

// ── Step 4: Wants + Feelings ──────────────────────────────────────────────────
function StepWants({ wants, update, next }) {
  const visible = useFadeIn([]);
  const [items, setItems] = useState(
    SEED_WANTS.map(w => ({ text: w, feeling: null }))
  );
  const [customText, setCustomText] = useState("");
  const [activePicker, setActivePicker] = useState(null); // index

  const setFeeling = (idx, feeling) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, feeling } : it));
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
          Behind every "I want..." there's a real feeling. Name it. That's the part that tells you whether a job is actually right not the title, not the salary.
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((item, idx) => (
            <div key={idx}>
              <div
                onClick={() => setActivePicker(activePicker === idx ? null : idx)}
                style={{
                  padding: "14px 16px", borderRadius: activePicker === idx ? "10px 10px 0 0" : 10,
                  background: C.surface,
                  border: `1px solid ${item.feeling ? C.tide : activePicker === idx ? C.ocean : C.borderSoft}`,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  cursor: "pointer", transition: "border-color 0.15s",
                }}
              >
                <span style={{ fontSize: 13, color: item.feeling ? C.text : C.muted, flex: 1 }}>{item.text}</span>
                {item.feeling
                  ? <span style={{
                      fontSize: 10, padding: "3px 10px", borderRadius: 20,
                      background: (FEELINGS.find(f => f.id === item.feeling)?.color || C.ocean) + "20",
                      color: FEELINGS.find(f => f.id === item.feeling)?.color || C.ocean,
                      border: `1px solid ${(FEELINGS.find(f => f.id === item.feeling)?.color || C.ocean)}40`,
                      whiteSpace: "nowrap", marginLeft: 10,
                    }}>{item.feeling}</span>
                  : <span style={{ fontSize: 11, color: C.dim, marginLeft: 10 }}>tag →</span>
                }
              </div>
              {activePicker === idx && (
                <div style={{
                  background: C.raised, border: `1px solid ${C.ocean}`,
                  borderTop: "none", borderRadius: "0 0 10px 10px",
                  padding: "12px", display: "flex", flexWrap: "wrap", gap: 7,
                }}>
                  {FEELINGS.map(f => (
                    <div
                      key={f.id}
                      onClick={() => setFeeling(idx, f.id)}
                      style={{
                        padding: "6px 14px", borderRadius: 20, cursor: "pointer",
                        background: f.color + "18", color: f.color,
                        border: `1px solid ${f.color}40`,
                        fontSize: 12, transition: "all 0.12s",
                      }}
                    >{f.id}</div>
                  ))}
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
          {tagged} tagged {tagged < 3 ? `${3 - tagged} more and we're moving` : "looking good"}
        </div>
        <Btn onClick={() => { update({ wants: items }); next(); }} disabled={tagged < 3}>
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

function StepPause({ finish }) {
  const visible = useFadeIn([]);
  return (
    <div style={{
      ...fadeStyle(visible),
      display: "flex", flexDirection: "column",
      justifyContent: "center", alignItems: "center",
      minHeight: "100vh", padding: "48px 32px", textAlign: "center",
    }}>
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 52, display: "inline-block", animation: "pulse 3.5s ease-in-out infinite", marginBottom: 28 }}>
          💙
        </div>
        <TideWave />
        <h2 style={{ fontSize: 26, fontWeight: 400, margin: "36px 0 18px", color: C.pearl, lineHeight: 1.4 }}>
          That took something.
        </h2>
        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, margin: "0 auto", maxWidth: 272 }}>
          You named the brave thing and the fear underneath it. Most people never get that far.
        </p>
        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, margin: "20px auto 0", maxWidth: 272 }}>
          Take a breath. More soon.
        </p>
      </div>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <Btn onClick={finish}>one last thing →</Btn>
      </div>
      <p style={{ fontSize: 11, color: C.dim, marginTop: 24, fontStyle: "italic" }}>
        "the karma compounds quietly."
      </p>
    </div>
  );
}

// ── Step 4: Matrix Pause + Return Check-in ───────────────────────────────────
const QUADRANT_TASKS = {
  "brave-curious": {
    headline: "You're moving and you're open.",
    task: "Before you come back — reach out to one person in your network you haven't talked to in a year. No agenda. Just check in.",
  },
  "brave-judgmental": {
    headline: "You're willing to move. Stay open about where.",
    task: "Before you come back — spend 20 minutes listening to someone whose career path looks nothing like yours. Podcast, interview, conversation. Just listen.",
  },
  "fearful-curious": {
    headline: "You see it. Something's holding you back.",
    task: "Before you come back — write down the one career move you keep circling but haven't made. Don't share it. Just put it somewhere real.",
  },
  "fearful-judgmental": {
    headline: "You're in a careful place right now. That's okay.",
    task: "Before you come back — do one thing today that feels even slightly uncomfortable. Doesn't have to be career-related. Just move.",
  },
};

function StepMatrixPause({ selfPosition, next, goBack }) {
  const visible = useFadeIn([]);
  const quadrant = selfPosition ? getQuadrant(selfPosition.x, selfPosition.y) : "fearful-curious";
  const qr = QUADRANT_READS[quadrant];

  return (
    <div style={{
      ...fadeStyle(visible), display: "flex", flexDirection: "column",
      justifyContent: "center", alignItems: "center",
      minHeight: "100vh", padding: "64px 28px 56px", textAlign: "center",
    }}>
      <div style={{ fontSize: 52, display: "inline-block", animation: "pulse 2.8s ease-in-out infinite", marginBottom: 36 }}>
        💙
      </div>

      <p style={{ fontSize: 11, letterSpacing: 3, color: C.muted, fontFamily: "monospace", margin: "0 0 16px" }}>COVE</p>
      <h2 style={{ fontSize: 22, fontWeight: 400, color: C.pearl, lineHeight: 1.55, margin: "0 0 8px" }}>
        your career, your current.
      </h2>
      <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.6, margin: "0 0 48px", fontStyle: "italic" }}>
        alright, now pause.
      </p>

      <div style={{
        padding: "20px 24px", borderRadius: 14, marginBottom: 48,
        background: C.surface, border: `1px solid ${C.borderSoft}`,
        textAlign: "left", maxWidth: 320, width: "100%",
      }}>
        <div style={{ fontSize: 12, color: qr.color, fontWeight: 600, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>
          {qr.title}
        </div>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.75, margin: 0 }}>{qr.short}</p>
        <button
          onClick={goBack}
          style={{ marginTop: 14, background: "none", border: "none", color: C.ocean, fontSize: 12, cursor: "pointer", padding: 0 }}
        >
          ← not quite right — move my dot
        </button>
      </div>

      <div style={{ width: "100%", maxWidth: 320 }}>
        <Btn onClick={next}>keep going</Btn>
      </div>
    </div>
  );
}

// ── Step 6: Ash Ketchum / Generous Enthusiasm ────────────────────────────────
function StepAshStory({ next }) {
  const visible = useFadeIn([]);
  const p = (text, extra = {}) => (
    <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, margin: "0 0 20px", ...extra }}>{text}</p>
  );
  return (
    <div style={{ ...fadeStyle(visible), padding: "80px 28px 56px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontFamily: "monospace", margin: "0 0 36px" }}>GENEROUS ENTHUSIASM</p>

        {p("You ever just help somebody. No reason. No angle.")}

        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, margin: "0 0 20px" }}>
          There's a scene in <em style={{ color: C.pearl, fontStyle: "italic" }}>Pokémon: Mewtwo Returns</em> that keeps coming back to me.
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
          Ash is helping Mewtwo escape — a Pokémon built in a lab, hunted, every reason not to trust anyone — and Mewtwo stops. Looks at him. Asks:
        </p>

        <blockquote style={{
          margin: "0 0 20px",
          padding: "20px 24px",
          borderLeft: `3px solid ${C.ocean}`,
          background: C.surface,
          borderRadius: "0 10px 10px 0",
        }}>
          <p style={{ fontSize: 18, fontWeight: 300, color: C.pearl, lineHeight: 1.55, margin: "0 0 10px", fontStyle: "italic" }}>
            "Do you always need a reason to help somebody?"
          </p>
          <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>— Ash Ketchum</p>
        </blockquote>

        {/* Ash reaction GIF */}
        <div style={{ margin: "0 0 24px", borderRadius: 12, overflow: "hidden", lineHeight: 0 }}>
          <img
            src="https://media.giphy.com/media/PB9EHrzfWJuLtv4n1M/giphy.gif"
            alt="Happy Pokémon"
            style={{ width: "100%", borderRadius: 12, display: "block" }}
          />
          <p style={{ fontSize: 9, color: C.dim, margin: "6px 0 0", letterSpacing: 1, textTransform: "uppercase" }}>via GIPHY · Pokémon</p>
        </div>

        {p("He doesn't answer. He just keeps going.")}

        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, margin: "0 0 12px" }}>
          The people I've watched move well through a job search — who leave rooms better than they found them, who build actual relationships instead of a pipeline — they all have some version of that. They show up before the ask. They give before the taking is even on the table.
        </p>

        <p style={{ fontSize: 15, color: C.pearl, lineHeight: 1.85, margin: "0 0 4px" }}>
          It's not a strategy. It's a posture.
        </p>
        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, margin: "0 0 48px" }}>
          And it changes everything.
        </p>
      </div>

      <Btn onClick={next}>no, I don't.</Btn>
    </div>
  );
}

// ── Step 8: Brave Reflection ──────────────────────────────────────────────────
function StepBraveReflect({ next }) {
  const visible = useFadeIn([]);
  const [text, setText] = useState("");

  return (
    <div style={{ ...fadeStyle(visible), padding: "72px 28px 48px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontFamily: "monospace", margin: "0 0 16px" }}>BRAVE DECISIONS</p>
        <h2 style={{ fontSize: 24, fontWeight: 400, margin: "0 0 10px", color: C.pearl, lineHeight: 1.35 }}>
          What would a brave career decision look like right now?
        </h2>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: "0 0 24px" }}>
          Not the safe answer. The one that keeps surfacing when you're quiet enough to hear it.
        </p>
        <VoiceOrText
          value={text}
          onChange={setText}
          placeholder="What would you do if you weren't afraid of the outcome?"
        />
      </div>
      <Btn onClick={() => next(text)} disabled={!text.trim()} style={{ marginTop: 28 }}>
        That's it
      </Btn>
    </div>
  );
}

// ── Step 6: Fears Reflection (session 2) ─────────────────────────────────────
function StepFearsReflect({ next }) {
  const visible = useFadeIn([]);
  const [text, setText] = useState("");

  return (
    <div style={{ ...fadeStyle(visible), padding: "72px 28px 48px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontFamily: "monospace", margin: "0 0 16px" }}>WHAT'S IN THE WAY</p>
        <h2 style={{ fontSize: 24, fontWeight: 400, margin: "0 0 10px", color: C.pearl, lineHeight: 1.35 }}>
          What fears or judgments are getting in the way?
        </h2>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: "0 0 24px" }}>
          Name them. You don't have to solve them here — just say them out loud.
        </p>
        <VoiceOrText
          value={text}
          onChange={setText}
          placeholder="The story I keep telling myself is…"
        />
      </div>
      <Btn onClick={() => next(text)} disabled={!text.trim()} style={{ marginTop: 28 }}>
        I said it
      </Btn>
    </div>
  );
}


// ── Step 6: Done ──────────────────────────────────────────────────────────────
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

function MainApp({ userData, update, tab, setTab, activeContact, setActiveContact }) {
  const openContact = (c) => { setActiveContact(c); setTab("contact"); };

  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 22px", borderBottom: `1px solid ${C.borderSoft}`,
          position: "sticky", top: 0, background: C.bg, zIndex: 20,
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
            {tab !== "contact" && `hi, ${userData.name || "you"}`}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
          {tab === "home"      && <HomeTab      userData={userData} openContact={openContact} setTab={setTab} />}
          {tab === "contact"   && activeContact && <ContactTab contact={activeContact} />}
          {tab === "values"    && <ValuesTab    wants={userData.wants} />}
          {tab === "matrix"    && <MatrixTab    contacts={userData.contacts} openContact={openContact} selfPosition={userData.selfPosition} name={userData.name} />}
          {tab === "vibes"     && <VibesTab />}
        </div>

        {/* Bottom nav */}
        <div style={{
          display: "flex", justifyContent: "space-around",
          padding: "12px 8px 24px",
          borderTop: `1px solid ${C.borderSoft}`,
          background: C.bg,
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20,
        }}>
          {[
            { id: "home",   label: "Home",   icon: "⌂" },
            { id: "values", label: "Values", icon: "◇" },
            { id: "matrix", label: "Matrix", icon: "⊹" },
            { id: "vibes",  label: "Vibes",  icon: "〰" },
          ].map(t => (
            <div
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                padding: "6px 16px", borderRadius: 10, cursor: "pointer",
                color: tab === t.id ? C.ocean : C.muted,
                transition: "color 0.15s",
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span>
              <span style={{ fontSize: 9, letterSpacing: 0.5, fontFamily: "monospace" }}>{t.label.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

// ── Home Tab ──────────────────────────────────────────────────────────────────
function HomeTab({ userData }) {
  const visible = useFadeIn(["home"]);
  const quadrant = userData.selfPosition ? getQuadrant(userData.selfPosition.x, userData.selfPosition.y) : null;
  const qr = quadrant ? QUADRANT_READS[quadrant] : null;

  return (
    <div style={{ ...fadeStyle(visible), padding: "28px 22px" }}>

      {/* Greeting */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 24, fontWeight: 400, margin: "0 0 10px", color: C.pearl, letterSpacing: -0.3 }}>
          Take a breath.
        </h1>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.85, margin: 0 }}>
          You've done the hard part. You placed yourself on the map. Most people never do that — they just keep moving without knowing where they're starting from.
        </p>
      </div>

      {/* Matrix read */}
      {qr && (
        <div style={{ marginBottom: 32 }}>
          <SectionLabel>where you are right now</SectionLabel>
          <div style={{
            padding: "20px", borderRadius: 12,
            background: C.surface, border: `1px solid ${C.borderSoft}`,
          }}>
            <div style={{ fontSize: 15, color: qr.color, fontWeight: 500, marginBottom: 8 }}>{qr.title}</div>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.8, margin: 0 }}>{qr.read}</p>
          </div>
        </div>
      )}

      {/* Why the matrix matters */}
      <div style={{ marginBottom: 32 }}>
        <SectionLabel>why this matters</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { icon: "📍", title: "It's a starting point, not a verdict", body: "Where you place yourself today is just data. It changes. That's the whole point — Cove is here to help you move." },
            { icon: "🔄", title: "Honesty is the strategy", body: "The people who get the furthest fastest are the ones who see themselves clearly. Not harshly — clearly. The matrix is practice for that." },
            { icon: "🌊", title: "What's coming", body: "We're building out the next layer — values exploration, connection mapping, the full picture. For now, sit with where you are. That's enough." },
          ].map((item, i) => (
            <div key={i} style={{
              padding: "18px 20px", borderRadius: 12,
              background: C.surface, border: `1px solid ${C.borderSoft}`,
              display: "flex", gap: 14, alignItems: "flex-start",
            }}>
              <span style={{ fontSize: 20, lineHeight: 1, marginTop: 2 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 13, color: C.pearl, fontWeight: 500, marginBottom: 5 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.75 }}>{item.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quote */}
      <blockquote style={{
        margin: 0, padding: "18px 20px", borderRadius: 12,
        background: C.surface, border: `1px solid ${C.borderSoft}`,
        borderLeft: `2px solid ${C.oceanDeep}`,
      }}>
        <p style={{ margin: 0, fontSize: 13, color: C.muted, fontStyle: "italic", lineHeight: 1.9 }}>
          "The karma compounds quietly."
        </p>
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
        {contacts.map((c, i) => (
          <div
            key={i}
            onClick={() => openContact(c)}
            onTouchStart={() => setHovered(c.first)}
            onTouchEnd={() => setHovered(null)}
            style={{
              position: "absolute",
              left: `${c.quadrant?.x || 65}%`,
              top: `${c.quadrant?.y || 30}%`,
              transform: "translate(-50%,-50%)",
              cursor: "pointer", zIndex: 10,
            }}
          >
            <Avatar name={c.first} size={36} />
            <div style={{
              position: "absolute", top: "110%", left: "50%", transform: "translateX(-50%)",
              fontSize: 8, color: C.muted, whiteSpace: "nowrap", marginTop: 3,
              fontFamily: "monospace",
            }}>{c.first}</div>
          </div>
        ))}
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
    <div style={{ ...fadeStyle(visible), padding: "28px 22px" }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 400, margin: "0 0 8px", color: C.pearl }}>Vibes</h2>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: 0 }}>
          The job search is a long game. Keep something here that reminds you why you're even playing.
        </p>
      </div>

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
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════

function Shell({ children }) {
  return (
    <div style={{
      background: C.bg, minHeight: "100vh", color: C.text,
      fontFamily: "'Georgia', 'Times New Roman', serif",
      maxWidth: 480, margin: "0 auto",
      position: "relative",
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
  return (
    <div
      onClick={!disabled ? onClick : undefined}
      style={{
        width: "100%", padding: "16px", borderRadius: 12,
        background: disabled ? C.faint : `linear-gradient(135deg, ${C.oceanDeep}, ${C.tide})`,
        color: disabled ? C.muted : "#e8f4fc",
        fontSize: 15, textAlign: "center", cursor: disabled ? "default" : "pointer",
        transition: "opacity 0.15s", opacity: disabled ? 0.6 : 1,
        fontFamily: "Georgia, serif",
        userSelect: "none",
        boxSizing: "border-box",
        ...style,
      }}
    >{children}</div>
  );
}

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

function fadeStyle(visible) {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(10px)",
    transition: "opacity 0.35s ease, transform 0.35s ease",
  };
}
