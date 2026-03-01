# cove.
> *your career, your current.*

A mobile-first career coaching app. Not a job board. Not a resume builder. A smart, simple, and clean system for building the career that you want.

Live: **[cove-nu.vercel.app](https://cove-nu.vercel.app)**

---

## What it is

Cove is a reflective onboarding experience that starts with *you* — where you actually sit as a person — then helps you understand what you're really chasing, and what's in the way.

Built on three ideas:
- **Go-Giver first** — show up with something to offer *(The Go-Giver, Bob Burg & John David Mann)*
- **Careers over cash** — the right fit pays you back in ways money can't count
- **Generous enthusiasm** — *"Do you always need a reason to help somebody?"* — Ash Ketchum

---

## Stack

- React 18, react-scripts 5.0.1
- Zero external libraries — inline styles throughout
- Hooks only: `useState`, `useEffect`, `useRef`
- Mobile-first, max-width 480px
- localStorage for session persistence
- Discord webhook for reflection notifications

---

## Onboarding flow (10 steps)

1. **Welcome** — landing + tagline
2. **Privacy** — data commitments
3. **Philosophy** — three principles (Go-Giver, Careers over Cash, Generous Enthusiasm)
4. **Name** — what do people call you?
5. **Self Matrix** — plot yourself: Brave/Fearful × Curious/Judgmental
6. **Matrix Pause** — stop-and-go: task card, come back when done
7. **Pricing** — membership ($5/month trial)
8. **Brave Reflect** — what would a brave career decision look like?
9. **Fears Reflect** — what's in the way?
10. **Heart Pause** — terminal screen, reflections sent to Discord

---

## Getting started

```bash
git clone https://github.com/chieffhiwa/cove.git
cd cove
npm install
npm start
```

Opens at `http://localhost:3000`. Best viewed in Chrome DevTools mobile view (iPhone 14 Pro).

To clear session state and restart onboarding:
```
DevTools → Application → Local Storage → localhost:3000 → Clear All
```

---

## Structure

```
cove/
├── public/
│   └── index.html        # global styles, keyframe animations
├── src/
│   ├── App.jsx           # entire app (~1600 lines) — all components inline
│   └── index.js          # React DOM entry point
├── .gitignore
├── package.json
└── README.md
```

---

## Roadmap

| Milestone | Description | Status |
|-----------|-------------|--------|
| M1 | Vercel auto-deploy on push | ✅ Done |
| M2 | Supabase backend — auth + database | 🔜 Next |
| M3 | Matrix UX improvements — sticky, animated reveal | 🔜 |
| M4 | Analytics (PostHog) + coach dashboard | 🔜 |
| M5 | End-to-end flow: sign up → matrix → dashboard | 🔜 |
| M6 | Ship to clients — real users, collect phone/email | 🔜 |

### M2 plan (Supabase)
- Auth: magic link (email) or phone OTP
- Tables: `profiles`, `matrix_sessions`, `reflections`
- Replace localStorage with Supabase upserts
- Keep localStorage as optimistic cache

### M4 plan (Analytics)
- PostHog events: `onboarding_started`, `step_completed`, `matrix_placed`, `reflection_submitted`
- Internal coach dashboard at `/coach` — DAUs, quadrant distribution, user list

---

## Environment variables

```
REACT_APP_SUPABASE_URL=       # Supabase project URL
REACT_APP_SUPABASE_ANON_KEY=  # Supabase anon key
REACT_APP_POSTHOG_KEY=        # PostHog API key
REACT_APP_COACH_PASSWORD=     # Coach dashboard access
```

Set in `.env.local` for local dev, and in Vercel dashboard for production.

---

## Deploying

Vercel auto-deploys on every push to `main`. No manual steps needed.

```bash
git add .
git commit -m "your message"
git push origin main
# Vercel picks it up automatically → live in ~60s
```
