// ─── FEELING DEFINITIONS ──────────────────────────────────────────────────────
// Used in the "Wants" onboarding step (StepWants) and ValuesTab.
// Each feeling has an id (display name), a colour, and a short description.

export const FEELINGS = [
  { id: "Freedom",     color: "#38bdf8", desc: "Autonomy over when, where, and how you work" },
  { id: "Stability",   color: "#93c5fd", desc: "A financial floor you can actually build from" },
  { id: "Growth",      color: "#4ade80", desc: "Getting better at something that matters to you" },
  { id: "Purpose",     color: "#fbbf24", desc: "Work that means something beyond the paycheck" },
  { id: "Belonging",   color: "#c084fc", desc: "A team and culture where you genuinely fit" },
  { id: "Impact",      color: "#f87171", desc: "Changing something real in the world or in people" },
  { id: "Creativity",  color: "#fb923c", desc: "Making things, solving things, expressing things" },
  { id: "Legacy",      color: "#2dd4bf", desc: "Meaning that outlasts the role" },
  { id: "Joy",         color: "#fde68a", desc: "People and work that genuinely light something up" },
  { id: "Curiosity",   color: "#60a5fa", desc: "Problems worth losing yourself in" },
  { id: "Recognition", color: "#f9a8d4", desc: "Being seen and acknowledged for what you bring" },
  { id: "Access",      color: "#a78bfa", desc: "A seat where real decisions get made" },
];

// Seed "wants" shown to the user before they add their own
export const SEED_WANTS = [
  "Travel on my own terms",
  "Work from wherever",
  "Leave something lasting",
  "Work on hard problems",
  "Earn enough to breathe easy",
  "Be around people I admire",
  "Have a voice in the room",
  "Build things that get used",
];
