// ─── QUADRANT DEFINITIONS ─────────────────────────────────────────────────────
// The Bravery / Curiosity Matrix has four quadrants.
// x-axis: Judgmental (left, 0) → Curious (right, 100)
// y-axis: Brave (top, 0) → Fearful (bottom, 100)

// Per-quadrant landscape images (rotate by day+hour for freshness)
export const QUADRANT_IMAGES = {
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

export function getQuadrantImage(quadrant) {
  const arr = QUADRANT_IMAGES[quadrant] || QUADRANT_IMAGES["brave-curious"];
  return arr[(new Date().getDate() + new Date().getHours()) % arr.length];
}

// Short title, color, and copy for each quadrant — used across onboarding and main app
export const QUADRANT_READS = {
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
    read: "Something's made you careful. That's data worth reading. Before you optimize for the right role, find one person: a mentor, a sponsor, someone who's seen you at your best and will say so. The right environment will follow. Cove is a good place to map who that person might be.",
    jobs: ["Find a mentor first", "Low-stakes experiments", "Internal moves"],
  },
};

// Helper: map (x, y) coordinates → quadrant key
export function getQuadrant(x, y) {
  const brave = y < 50;
  const curious = x > 50;
  if (brave && curious)   return "brave-curious";
  if (brave && !curious)  return "brave-judgmental";
  if (!brave && curious)  return "fearful-curious";
  return "fearful-judgmental";
}

// Per-quadrant long-form stories — shown in StepQuadrantRead
export const QUADRANT_STORIES = {
  "brave-curious": {
    label: "THE FAST MOVER",
    headline: "You ask the right questions before anyone else.",
    body: [
      "There's a moment in every room when someone decides to go first. To say the thing. To try the approach that might not work. You're usually that person — or you're the one who sees it clearly enough that you should be.",
      "Carol Dweck spent years studying what separates people who improve from people who plateau. Her finding was simple: the learners believe ability grows. They lean toward challenges instead of away from them. That's you, right now. Brave enough to move. Curious enough to keep updating.",
      "Your risk isn't failure. Your risk is moving so fast you skip the step that would have made the next ten easier. The best version of this quadrant doesn't just move — it moves with a question in its hand.",
      "Environments that fit you: early-stage startups, innovation roles, places still figuring out the playbook. Places where \"we haven't tried that yet\" is an invitation, not a warning.",
    ],
  },
  "brave-judgmental": {
    label: "THE STANDARD HOLDER",
    headline: "You know what good looks like. Sit with that.",
    body: [
      "There's a version of \"high standards\" that's just fear of being wrong. But there's another version — the one you have — where you've actually seen enough to know the difference. You've built a model of quality, and you hold it.",
      "The research on conscientiousness shows it's one of the strongest predictors of long-term career success. Not charisma. Not raw intelligence. The willingness to do the thing right, even when no one's checking.",
      "Where this gets complicated: the line between conviction and rigidity. The best standard-holders stay open to the possibility that their model of good is incomplete. Not because they're wishy-washy — because they're curious enough to update.",
      "Environments that fit you: operations, editorial, leadership, policy — anywhere that needs someone who won't fold under pressure. Watch for places that mistake loudness for confidence. You deserve rooms where substance is the currency.",
    ],
  },
  "fearful-curious": {
    label: "THE DEEP THINKER",
    headline: "You process differently. That's the whole thing.",
    body: [
      "Here's what looks like hesitation from the outside: you reading the room before you move. Noticing the thing no one else noticed. Asking the question quietly, to yourself first, before you know whether the room is safe enough for it.",
      "Amy Edmondson's research on psychological safety changed how we think about high-performing teams. Her finding: teams don't perform well because they never fail. They perform well because they're safe enough to try — and safe enough to say when something's not working.",
      "You do your best thinking in environments with that kind of safety — the presence of trust. You need a room that rewards depth over speed.",
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

// Per-quadrant pause screen content (shown between matrix placement and reflection)
export const QUADRANT_TASKS = {
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

export const QUADRANT_PAUSE = {
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
