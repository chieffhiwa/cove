# cove.
> *your career. your current.*

Mobile-first career coaching app. Not a job board. A system for building the career you actually want — starting with where you actually are.

**Live → [cove-main.vercel.app](https://cove-main.vercel.app)**

---

## Stack

- React 18 (Create React App) — all components in `src/App.jsx`
- Supabase — auth + database
- Vercel — auto-deploys on push to `main`
- `api/chat.js` — serverless proxy for Anthropic (AI coach)
- PostHog — analytics
- No external UI libraries. Inline styles throughout.

---

## Run locally

```bash
git clone https://github.com/chieffhiwa/cove.git
cd cove
npm install
```

Create `.env.local`:
```
REACT_APP_SUPABASE_URL=
REACT_APP_SUPABASE_ANON_KEY=
REACT_APP_POSTHOG_KEY=
ANTHROPIC_KEY=
```

```bash
npm start   # localhost:3000
```

Reset onboarding: DevTools → Application → Local Storage → Clear All

---

## White-label pages

Static HTML pages live in `public/` and are served at their filename:

| URL | File |
|-----|------|
| `/bowdoin.html` | Bowdoin College landing page |
| `/repairs.html` | — |
| `/cove-ux-feedback.html` | UX feedback form |

To add a new community version: copy `public/bowdoin.html`, retheme, deploy at `/yourcommunity.html`.

---

## Supabase

Project: `xjsikoqnffpnanokqgod`

Tables: `profiles`, `matrix_sessions`, `reflections`, `questions`, `user_answers`, `user_matrix_scores`

---

## Roadmap

### Done
| | Item |
|---|---|
| ✅ | Auth, onboarding, matrix, reflections |
| ✅ | AI coach (proxied via serverless fn) |
| ✅ | Dark/light mode throughout |
| ✅ | White-label landing pages (Bowdoin) |
| 🔄 | Profile restore on login |

### Now — Infrastructure
| | Item | Owner |
|---|---|---|
| 🔜 | Acquire `cove.app` domain | Fhiwa |
| 🔜 | Backend infrastructure + email setup on `cove.app` | Aaron Serpilin |
| 🔜 | Multi-tenant architecture (one codebase, many communities) | eng |
| 🔜 | Coach dashboard — read user profiles, send nudges | eng |

### Next — Biographical Matching (core product bet)
| | Item | Notes |
|---|---|---|
| 🔜 | User profile deepening via AI Q&A (5–7 questions → rich self-portrait) | The skeleton |
| 🔜 | Biographical match engine — surface 3–5 real people who walked your path | Alumni, career-changers, founders |
| 🔜 | Match display UI — name, path, how they got their first meeting | The mirror |
| 🔜 | Coach review layer — human reads matches, adds context before surfacing | The flesh |

### Later — Data & Growth
| | Item | Notes |
|---|---|---|
| 🔜 | Bowdoin Alumni Relations data ingestion | Pending institutional partnership |
| 🔜 | BCAN ambassador program — paid ambassadors onboard peers organically | Todd H., Madison, Molly, etc. |
| 🔜 | Expand to additional campuses via white-label | HBCUs, liberal arts, etc. |

---

## Contributing

High-leverage areas right now: biographical match engine, coach dashboard, splitting `App.jsx` (~5k lines).

Open an issue or ping [@chieffhiwa](https://github.com/chieffhiwa).
