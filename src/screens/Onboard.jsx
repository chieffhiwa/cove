// ─── Onboard ──────────────────────────────────────────────────────────────────
// The full onboarding flow. Steps roughly map to:
//   0–2   : name, email, why-this-exists intro
//   3–5   : bravery/curiosity matrix placement
//   6–9   : brave reflection questions
//   10–13 : fears/curiosity reflection
//   14–17 : wants/feelings selection
//   18+   : finish / transition to main app
//
// For Simon: user answers are collected in `userData` (see DEFAULT_USER_DATA
// in src/config/constants.js) and written to Supabase via postReflections()
// and upsertProfile() in src/lib/api.js at the end of the flow.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import { useFadeIn, fadeStyle } from "../lib/hooks";
import { FEELINGS, SEED_WANTS } from "../config/feelings";
import {
  QUADRANT_READS, QUADRANT_PAUSE, QUADRANT_STORIES,
  getQuadrant, getQuadrantImage,
} from "../config/quadrants";
// eslint-disable-next-line no-unused-vars
import { DEPTH_STOPS, getDepthPalette, DARK } from "../config/palette";
import { postReflections, upsertProfile } from "../lib/api";
import { Btn } from "../components/Btn";
import { supabase } from "../supabase";
import { track, posthog, PH_KEY } from "../lib/analytics";
import { TAGLINE } from "../config/constants";
import { Shell } from "../components/Shell";
import { Avatar } from "../components/Avatar";

export function Onboard({ step, setStep, userData, update, finish, supaUser, darkMode, toggleDark, onGoToLogin }) {
  const C = useTheme();

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
    <StepBetaForm       key={22} name={userData.name} finish={() => { track("onboarding_completed"); finish(); }} />,
  ];

  // Dots: philosophy(4), name(5), matrix intro(6), matrix(7), brave(12), fears(13), list(16-22)
  const dotMap = { 4:1, 5:2, 6:3, 7:3, 12:4, 13:4, 16:5, 17:5, 18:5, 19:5, 20:5, 21:5, 22:5 };
  const showDots = step in dotMap;
  const dotStep = dotMap[step] || 0;

  return (
    <Shell depth={step}>
      {/* Back button */}
      <div
        onClick={() => step === 0 ? onGoToLogin?.() : setStep(step - 1)}
        style={{
          position: "absolute", top: 16, left: 18, zIndex: 20,
          fontSize: 22, color: C.muted, cursor: "pointer",
          padding: "6px 10px", borderRadius: 8,
          lineHeight: 1,
        }}
      >‹</div>
      {/* Dark mode toggle */}
      <button
        onClick={toggleDark}
        style={{
          position: "absolute", top: 16, right: step > 0 ? 60 : 18, zIndex: 20,
          background: "none", border: "none", cursor: "pointer",
          fontSize: 16, color: C.dim, padding: "6px 8px", lineHeight: 1,
        }}
        title={darkMode ? "switch to light" : "switch to dark"}
      >{darkMode ? "☀︎" : "☽"}</button>
      {/* Skip onboarding */}
      {step > 0 && (
        <button
          onClick={() => { track("onboarding_skipped", { at_step: step }); finish(); }}
          style={{
            position: "absolute", top: 20, right: 18, zIndex: 20,
            background: "none", border: "none", cursor: "pointer",
            fontSize: 11, color: C.dim, fontFamily: "monospace",
            letterSpacing: 1, padding: 0, lineHeight: 1,
          }}
        >skip</button>
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
  const C = useTheme();
  const visible = useFadeIn([]);
  return (
    <div style={{ ...fadeStyle(visible), display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", minHeight:"100vh", padding:"48px 32px", textAlign:"center" }}>
      <div style={{ marginBottom: 52 }}>
        <div style={{ fontSize: 11, letterSpacing: 8, color: C.sky, fontFamily: "monospace", marginBottom: 32, opacity: 0.7 }}>
          C O V E
        </div>
        <h1 style={{ fontSize: 38, fontWeight: 400, margin: "0 0 22px", color: C.pearl, lineHeight: 1.25, letterSpacing: -1 }}>
          Find work that<br />actually fits.
        </h1>
        <p style={{ fontSize: 15, color: C.mist, lineHeight: 1.9, margin: "0 0 28px", maxWidth: 300 }}>
          A simple, proven system to build the career you actually want.
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
  const C = useTheme();
  const visible = useFadeIn([]);
  return (
    <div style={{ ...fadeStyle(visible), padding: "64px 28px 48px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 10, letterSpacing: 3, color: C.sky, fontFamily: "monospace", margin: "0 0 20px", opacity: 0.7 }}>WHY THIS EXISTS</p>

        <h2 style={{ fontSize: 28, fontWeight: 400, margin: "0 0 14px", color: C.pearl, lineHeight: 1.3 }}>
          The job search is broken.
        </h2>
        <p style={{ fontSize: 15, color: C.mist, lineHeight: 1.85, margin: "0 0 28px" }}>
          Cove gives you a framework, a tool, and a coach to navigate your career with way less friction. Less friction means a faster pathway to unlocking your next job or opportunity.
        </p>

        {/* Stats */}
        <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
          {[
            { stat: "40×", label: "more replies warm vs. cold" },
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
          { n: "01", title: "Know yourself", body: "The Bravery × Curiosity Matrix is a simple framework for getting an honest read on where you actually are." },
          { n: "02", title: "Build the list", body: <>Start reaching out to people in your network before you need something. ✨ Inspired by <a href="https://carlyvalancy.substack.com" target="_blank" rel="noopener noreferrer" style={{ color: C.ocean, textDecoration: "none" }}>Carly Valancy</a>'s 100 Days Project — the right doors are already within reach.</> },
          { n: "03", title: "Talk it out", body: "Get honest about the fears and judgments that are getting in your way." },
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
            100% open-source. Built by those who went through it, and wanted something better.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a
              href="https://github.com/chieffhiwa/cove"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: C.ocean, textDecoration: "none", fontFamily: "monospace", letterSpacing: 0.5, display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, background: C.ocean + "18", border: `1px solid ${C.ocean}40` }}
            >
              ↗ view on github
            </a>
            <a
              href="https://github.com/sponsors/chieffhiwa"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: "#e85d7a", textDecoration: "none", fontFamily: "monospace", letterSpacing: 0.5, display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, background: "#e85d7a18", border: "1px solid #e85d7a40" }}
            >
              ♥ sponsor
            </a>
          </div>
        </div>
      </div>

      <Btn onClick={next} style={{ marginTop: 32 }}>Next →</Btn>
    </div>
  );
}

// ── Step 2: Slow Down ─────────────────────────────────────────────────────────
function StepSlowDown({ next }) {
  const C = useTheme();
  const visible = useFadeIn([]);
  return (
    <div style={{ ...fadeStyle(visible), display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", padding: "48px 32px", textAlign: "center" }}>
      <div style={{ marginBottom: 48, maxWidth: 300 }}>
        <div style={{ fontSize: 36, marginBottom: 28 }}>🌊</div>
        <h2 style={{ fontSize: 30, fontWeight: 400, margin: "0 0 20px", color: C.pearl, lineHeight: 1.3, letterSpacing: -0.5 }}>
          This takes a couple minutes.
        </h2>
        <p style={{ fontSize: 16, color: C.mist, lineHeight: 1.9, margin: "0 0 20px" }}>
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
  const C = useTheme();
  const visible = useFadeIn([]);
  const commitments = [
    { icon: "🔒", title: "Your data stays yours", body: "Your reflections stay with you. We don't sell them, share them, or use them for anything else." },
    { icon: "👁️", title: "No surveillance", body: "A career tool. Full stop." },
    { icon: "💙", title: "A personal commitment", body: "This works for you, or it doesn't work. Tell us if we break that trust." },
    { icon: "⚖️", title: "We build against bias", body: "Built to surface your strengths. Something feels off? Say so." },
  ];

  return (
    <div style={{ ...fadeStyle(visible), padding: "72px 28px 48px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 10, letterSpacing: 3, color: C.sky, fontFamily: "monospace", margin: "0 0 18px", opacity: 0.7 }}>BEFORE WE START</p>
        <h2 style={{ fontSize: 28, fontWeight: 400, margin: "0 0 12px", color: C.pearl, lineHeight: 1.3 }}>
          We don't touch your data.
        </h2>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.85, margin: "0 0 28px" }}>
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
                <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 6 }}>{c.title}</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.8 }}>{c.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Btn onClick={next} style={{ marginTop: 32 }}>Next →</Btn>
    </div>
  );
}

// ── Step 3: Philosophy ── (was Step 1) ───────────────────────────────────────
function StepPhilosophy({ next }) {
  const C = useTheme();
  const visible = useFadeIn([]);
  const principles = [
    { icon: "💙", title: "“Go-Giver” first", body: "Give before you ask. Show up with something to offer.", cite: "The Go-Giver — Bob Burg & John David Mann" },
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
      <Btn onClick={next} style={{ marginTop: 32 }}>Next →</Btn>
    </div>
  );
}

// ── Step 2: Name ──────────────────────────────────────────────────────────────
function StepName({ next }) {
  const C = useTheme();
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
          autoComplete="given-name"
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

// ── Step 5: Matrix Intro ──────────────────────────────────────────────────────
function StepMatrixIntro({ name, next }) {
  const C = useTheme();
  const visible = useFadeIn([]);
  return (
    <div style={{ ...fadeStyle(visible), padding: "72px 28px 48px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontFamily: "monospace", margin: "0 0 20px" }}>THE MATRIX</p>
        <h2 style={{ fontSize: 26, fontWeight: 400, margin: "0 0 16px", color: C.pearl, lineHeight: 1.4 }}>
          Where are you right now?
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
          A snapshot of right now. Honest, not aspirational.
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

      <Btn onClick={next} style={{ marginTop: 32 }}>Place yourself on the matrix →</Btn>
    </div>
  );
}

// ── Step 3: Self Matrix ───────────────────────────────────────────────────────

function StepSelfMatrix({ name, initialPosition, next }) {
  const C = useTheme();
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
              Want to move your dot?
            </h2>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: "0 0 22px" }}>
              Move your dot. This is about how you actually see yourself right now — honest, present. Where are you today?
            </p>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 24, fontWeight: 400, margin: "0 0 8px", color: C.pearl, lineHeight: 1.35 }}>
              Be real with yourself.
            </h2>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: "0 0 22px" }}>
              Brave or fearful? Curious or judgmental? Be honest. Where you actually are today.
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
              background: `linear-gradient(135deg, #5bb8f5, #2e8fd4)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, fontWeight: 700, color: "#fff",
              boxShadow: `0 2px 12px rgba(46,143,212,0.4)`,
              border: `2px solid rgba(255,255,255,0.6)`,
            }}>
              ◉
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

// ── Step 16: List — cinematic intro ───────────────────────────────────────────
function StepListDialogue({ name, next }) {
  const C = useTheme();
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
          fontSize: 11, letterSpacing: 3, color: C.muted,
          fontFamily: "monospace", margin: 0, opacity: 0.7,
        }}>THE LIST</p>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "0 28px 48px", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <h2 style={{ fontSize: 30, fontWeight: 300, color: C.pearl, lineHeight: 1.4, margin: "0 0 16px" }}>
          Who do you actually <em>need</em> to talk to?
        </h2>
        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, margin: "0 0 8px" }}>
          Not a dream. Not a stretch. The people — real or aspirational — you'd actually want 20 minutes with.
        </p>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.85, margin: "0 0 32px", fontStyle: "italic" }}>
          Everyone you know has a warm connection to someone you don't.
        </p>
        <Btn onClick={next}>Let's build it →</Btn>
      </div>
    </div>
  );
}

// ── Step 17: Warm vs Cold ─────────────────────────────────────────────────────
function StepWarmCold({ next }) {
  const C = useTheme();
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

          <Btn onClick={next}>Build the list →</Btn>
        </div>
      </div>

    </div>
  );
}

// ── Step 18: List builder ─────────────────────────────────────────────────────
function StepListBuilder({ contacts = [], update, next }) {
  const C = useTheme();
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
        <h2 style={{ fontSize: 26, fontWeight: 300, color: C.pearl, lineHeight: 1.4, margin: "0 0 10px", whiteSpace: "nowrap" }}>
          Who do you <em>need</em> to talk to?
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
  const C = useTheme();
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

      <Btn onClick={next} style={{ marginTop: 32 }}>Next →</Btn>
    </div>
  );
}

// ── Step 18: Breath ────────────────────────────────────────────────────────────
function StepBreath({ name, contacts = [], selfPosition, next }) {
  const C = useTheme();
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
        <Btn onClick={next}>Next →</Btn>
      </div>

      <p style={{ fontSize: 11, color: C.dim, marginTop: 20, fontStyle: "italic" }}>almost done</p>
    </div>
  );
}

// ── VoiceOrText — reusable voice/text input ────────────────────────────────
function VoiceOrText({ value, onChange, placeholder }) {
  const C = useTheme();
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
  const C = useTheme();
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
  const C = useTheme();
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

// ── Step 10: Careers Over Cash ────────────────────────────────────────────────
function StepCareersOverCash({ next }) {
  const C = useTheme();
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

      <Btn onClick={next} style={{ marginTop: 8 }}>Next →</Btn>
    </div>
  );
}

// ── Step 4: Matrix Pause + Return Check-in ───────────────────────────────────

function StepMatrixPause({ selfPosition, next, goBack }) {
  const C = useTheme();
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
        <OnboardSectionLabel>where others landed</OnboardSectionLabel>
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

      <Btn onClick={next}>Next →</Btn>
    </div>
  );
}

// ── Step 6: Quadrant Reveal ───────────────────────────────────────────────────
function StepQuadrantReveal({ selfPosition, next }) {
  const C = useTheme();
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

          <Btn onClick={next}>What this means for you →</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Step 7: Quadrant Read — per-quadrant "so what" story ─────────────────────

function StepQuadrantRead({ selfPosition, next }) {
  const C = useTheme();
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

      <Btn onClick={next} style={{ marginTop: 32 }}>Next →</Btn>
    </div>
  );
}

// ── Step 8: Ash Ketchum / Generous Enthusiasm ────────────────────────────────
function StepAshStory({ next }) {
  const C = useTheme();
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

      <Btn onClick={next}>Next →</Btn>
    </div>
  );
}

// ── Step 8: Brave Reflection ──────────────────────────────────────────────────
function StepBraveReflect({ next }) {
  const C = useTheme();
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
        Next →
      </Btn>
    </div>
  );
}

// ── Step 9: Fears Reflection ──────────────────────────────────────────────────
function StepFearsReflect({ next }) {
  const C = useTheme();
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
        Next →
      </Btn>
    </div>
  );
}


// ── Step 19: Founder note ──────────────────────────────────────────────────────
function StepFounderNote({ next }) {
  const C = useTheme();
  const visible = useFadeIn([]);

  return (
    <div style={{
      ...fadeStyle(visible),
      minHeight: "100vh", padding: "48px 28px 40px",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{ maxWidth: 340, margin: "0 auto", width: "100%", textAlign: "center", flex: 1 }}>
        <p style={{ fontSize: 10, letterSpacing: 3, color: C.dim, fontFamily: "monospace", margin: "0 0 20px", textTransform: "uppercase" }}>
          from the builder
        </p>

        <a
          href="https://www.linkedin.com/in/fndou/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", margin: "0 auto 16px", borderRadius: "50%", overflow: "hidden", width: 88, height: 88, border: `2px solid ${C.ocean}` }}
        >
          <img
            src="/fhiwa.jpg"
            alt="Fhiwa Ndou"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%", display: "block" }}
          />
        </a>

        <p style={{ fontSize: 20, fontWeight: 300, color: C.pearl, lineHeight: 1.4, margin: "0 0 20px", letterSpacing: -0.3 }}>
          it's just me.
        </p>

        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.85, margin: "0 0 14px" }}>
          Job searching is hard. So much of it feels well outside of our control, and it quietly messes with our heads until we've forgotten what it felt like to just be excited about work.
        </p>

        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.85, margin: "0 0 14px" }}>
          I still think about getting hired at Toys R Us, 18 years ago. I had no idea what I was in for — but I didn't care. I was curious.
        </p>

        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.85, margin: "0 0 24px" }}>
          We built this to get that feeling back. Turns out a lot of us need it.
        </p>

        <p style={{ fontSize: 12, color: C.dim, fontStyle: "italic", margin: "0 0 10px" }}>— Fhiwa Ndou</p>
        <a
          href="https://www.linkedin.com/in/fndou/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12, textDecoration: "none", display: "inline-block", marginBottom: 28,
            padding: "10px 20px", borderRadius: 24,
            background: C.ocean, color: "#fff",
            fontFamily: "monospace", letterSpacing: 1,
            boxShadow: `0 3px 12px rgba(30,111,168,0.3)`,
          }}
        >
          catch me on LinkedIn →
        </a>
      </div>

      <Btn onClick={next}>Next →</Btn>
    </div>
  );
}

// ── Fireworks canvas overlay ───────────────────────────────────────────────────
function Fireworks() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const PALETTE = [
      "#ffffff", "#f0f8ff", "#e8f4ff",
      "#c8d8e8", "#b0c4d8", "#d0dce8",
      "#1e6fa8", "#2e8fd4", "#4a9eca", "#6bb8e8", "#a8d4f5",
      "#d4a030", "#e8b84b", "#f5c842", "#ffd700", "#ffe066",
    ];

    class Particle {
      constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed - 1.5;
        this.alpha = 1;
        this.radius = Math.random() * 2.2 + 0.8;
        this.decay = Math.random() * 0.012 + 0.008;
        this.gravity = 0.07;
        this.twinkle = Math.random() > 0.6;
        this.twinkleRate = Math.random() * 0.2 + 0.1;
      }
      update() {
        this.x += this.vx; this.vy += this.gravity; this.y += this.vy;
        this.vx *= 0.97; this.alpha -= this.decay;
      }
      draw(t) {
        const r = this.twinkle ? this.radius * (0.6 + 0.4 * Math.sin(t * this.twinkleRate)) : this.radius;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 6; ctx.shadowColor = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    let particles = [], animId, t = 0, done = false;
    const W = () => canvas.width, H = () => canvas.height;
    const burst = (x, y) => {
      const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      const accent = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      for (let i = 0; i < 60 + Math.floor(Math.random() * 35); i++)
        particles.push(new Particle(x, y, i % 5 === 0 ? accent : color));
    };

    const schedule = [
      [0,    () => burst(W() * 0.5,  H() * 0.28)],
      [350,  () => burst(W() * 0.25, H() * 0.38)],
      [700,  () => burst(W() * 0.75, H() * 0.32)],
      [1100, () => burst(W() * 0.4,  H() * 0.22)],
      [1500, () => burst(W() * 0.65, H() * 0.42)],
      [1900, () => burst(W() * 0.2,  H() * 0.30)],
      [2350, () => burst(W() * 0.8,  H() * 0.25)],
      [2800, () => burst(W() * 0.5,  H() * 0.35)],
      [3300, () => { burst(W() * 0.35, H() * 0.28); burst(W() * 0.65, H() * 0.28); }],
    ];
    const timers = schedule.map(([delay, fn]) => setTimeout(fn, delay));
    const stopTimer = setTimeout(() => { done = true; }, 5000);

    const animate = () => {
      ctx.clearRect(0, 0, W(), H());
      t++;
      particles = particles.filter(p => p.alpha > 0.02);
      particles.forEach(p => { p.update(); p.draw(t); });
      if (!done || particles.length > 0) animId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      timers.forEach(clearTimeout);
      clearTimeout(stopTimer);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas ref={canvasRef}
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 50 }}
    />
  );
}

// ── Step Final: Arrival ────────────────────────────────────────────────────────
function StepBetaForm({ name, finish }) {
  const C = useTheme();
  const visible = useFadeIn([]);
  const [copied, setCopied] = useState(false);

  const shareUrl  = "https://cove-main.vercel.app";
  const shareText = `Hey! You have to try this career app — I wanna see where you land on the matrix. ${shareUrl}`;

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ text: shareText, url: shareUrl }); } catch {}
    } else {
      await navigator.clipboard?.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const perks = [
    { glyph: "◎", text: "Match with real professionals and coaches who've been where you are" },
    { glyph: "⊹", text: "Track your progress through your career exploration — not just job apps" },
    { glyph: "→", text: "Start going after opportunities, warm — not cold, never cold" },
    { glyph: "◑", text: "Build a record of every brave thing you've done, every door you've opened" },
  ];

  return (
    <div style={{ ...fadeStyle(visible), minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg, position: "relative" }}>

      <Fireworks />

      {/* Photo */}
      <div style={{ position: "relative", height: 270, overflow: "hidden", flexShrink: 0 }}>
        <img src="/fhiwa-kid.jpg" alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 50%", filter: "brightness(1.05) saturate(0.88)" }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(240,244,248,0.96) 100%)" }} />
        <p style={{ position: "absolute", bottom: 14, left: 22, fontSize: 10, color: C.dim, fontFamily: "monospace", letterSpacing: 1, margin: 0, fontStyle: "italic" }}>
          brave + curious since day one
        </p>
      </div>

      <div style={{ flex: 1, padding: "28px 24px 52px", display: "flex", flexDirection: "column", gap: 22 }}>

        <div>
          <p style={{ fontSize: 10, letterSpacing: 3, color: C.ocean, fontFamily: "monospace", margin: "0 0 10px", opacity: 0.85 }}>
            YOU MADE IT
          </p>
          <h2 style={{ fontSize: 27, fontWeight: 300, color: C.pearl, lineHeight: 1.3, margin: "0 0 10px", letterSpacing: -0.3 }}>
            This is just the beginning.
          </h2>
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.8, margin: 0 }}>
            You've done something real today. Most people never slow down enough to do this. Here's what comes next.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {perks.map((p, i) => (
            <div key={i} style={{
              display: "flex", gap: 14, alignItems: "flex-start",
              padding: "13px 16px", borderRadius: 11,
              background: C.surface, border: `1px solid ${C.borderSoft}`,
            }}>
              <span style={{ fontSize: 13, color: C.ocean, fontFamily: "monospace", flexShrink: 0, paddingTop: 2, opacity: 0.8 }}>{p.glyph}</span>
              <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>{p.text}</span>
            </div>
          ))}
        </div>

        <div onClick={handleShare} style={{
          padding: "13px 18px", borderRadius: 10, border: `1px solid ${C.border}`,
          background: C.surface, cursor: "pointer", display: "flex", alignItems: "center",
          gap: 12, touchAction: "manipulation",
        }}>
          <span style={{ fontSize: 14, color: C.ocean, fontFamily: "monospace", fontWeight: 600 }}>↗</span>
          <div>
            <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 2 }}>
              {copied ? "Copied — send it." : "Bring someone with you"}
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>who else needs to figure this out?</div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <button onClick={finish} style={{
          padding: "19px 24px", cursor: "pointer", border: "none",
          background: C.ocean, color: "#fff", width: "100%",
          fontSize: 17, borderRadius: 12, fontFamily: "Georgia, serif",
          letterSpacing: 0.3, touchAction: "manipulation",
          boxShadow: `0 4px 20px rgba(30,111,168,0.3)`,
        }}>
          open cove →
        </button>

      </div>
    </div>
  );
}

// ── Onboard-only SectionLabel ─────────────────────────────────────────────────
function OnboardSectionLabel({ children }) {
  const C = useTheme();
  return (
    <div style={{
      fontSize: 9, color: C.muted, letterSpacing: 1.5,
      fontFamily: "monospace", textTransform: "uppercase",
      marginBottom: 12,
    }}>{children}</div>
  );
}
