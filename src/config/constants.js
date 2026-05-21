// ─── APP-WIDE CONSTANTS ───────────────────────────────────────────────────────

// Tagline A/B test
// "A" = original  |  "B" = matrix hook  ← change one letter to switch
export const TAGLINE_VERSION = "A";
export const TAGLINE = TAGLINE_VERSION === "A"
  ? "your career. your current."
  : "where do you land on the matrix?";

// Default shape of the userData object used throughout the app
export const DEFAULT_USER_DATA = {
  name: "",
  email: "",
  phone: "",
  linkedin: "",
  photoUrl: "",
  selfPosition: null,
  braveReflection: "",
  fearsReflection: "",
  wants: [],
  contacts: [],
};

// Rotating quotes shown on the Home tab (one per calendar day)
export const HOME_QUOTES = [
  { text: "The karma compounds quietly.", attr: null },
  { text: "Do you always need a reason to help somebody?", attr: "— Ash Ketchum" },
  { text: "Careers over cash. The right fit pays you back in ways money can't count.", attr: null },
  { text: "Go-Giver first. Show up with something to offer.", attr: null },
  { text: "Where you start is not where you have to stay.", attr: null },
  { text: "The brave career decision is rarely the comfortable one.", attr: null },
  { text: "Your energy is finite. Spend it on people who multiply it.", attr: null },
  { text: "Generous enthusiasm is a superpower.", attr: null },
];
