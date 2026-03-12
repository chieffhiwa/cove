# cove.
> *your career, your current.*

A mobile-first career coaching app. Not a job board. Not a resume builder. A smart, simple, and clean system for building the career you actually want.

**Live → [cove-main.vercel.app](https://cove-main.vercel.app)**

---

## What it is

Cove is a reflective onboarding experience that starts with *you* — where you actually sit as a person — then helps you understand what you're really chasing, and what's in the way.

Built on three ideas:
- **Go-Giver first** — show up with something to offer *(The Go-Giver, Bob Burg & John David Mann)*
- **Careers over cash** — the right fit pays you back in ways money can't count
- **Generous enthusiasm** — *"Do you always need a reason to help somebody?"* — Ash Ketchum

---

## White-labeling & open sourcing

Cove is designed to be deployable for any community — a university, a bootcamp, a Discord server, a coaching practice. The idea: one codebase, many instances, each with its own branding and coach dashboard.

**Proof of concept → [bowdoin-cove.vercel.app](https://bowdoin-cove.vercel.app)**
This is a white-labeled version built for Bowdoin College. Same core flow, different skin and community context. It works. We want to make this easy for anyone to spin up.

If you're an engineer who wants to help build toward that — better theming, multi-tenant Supabase, a one-click deploy setup — you're in the right place.

---

## Backend

Supabase project: **[supabase.com/dashboard/project/xjsikoqnffpnanokqgod](https://supabase.com/dashboard/project/xjsikoqnffpnanokqgod)**
*(Requires team access — ping [@chieffhiwa](https://github.com/chieffhiwa) to be added)*

Tables: `profiles`, `matrix_sessions`, `reflections`

Coach dashboard (internal): `/coach` — password-protected analytics view, DAUs, quadrant distribution, user list. Ask for access if you need it.

---

## Stack

- React 18, react-scripts 5.0.1
- Supabase (auth + database)
- Zero external UI libraries — inline styles throughout
- Hooks only: `useState`, `useEffect`, `useRef`
- Mobile-first, max-width 480px
- localStorage for optimistic session caching
- Discord webhook for reflection notifications
- Deployed on Vercel (auto-deploy on push to `main`)

---

## Get running locally

```bash
git clone https://github.com/chieffhiwa/cove.git
cd cove
npm install
```

Create a `.env.local` file in the root:

```
REACT_APP_SUPABASE_URL=        # get from team or Supabase dashboard
REACT_APP_SUPABASE_ANON_KEY=   # get from team or Supabase dashboard
REACT_APP_POSTHOG_KEY=         # optional — analytics
REACT_APP_COACH_PASSWORD=      # optional — enables /coach dashboard
```

Then:

```bash
npm start
```

Opens at `http://localhost:3000`. Best viewed in Chrome DevTools mobile view (iPhone 14 Pro).

To reset onboarding and start fresh:
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
│   ├── App.jsx           # entire app — all components inline
│   ├── supabase.js       # Supabase client init
│   └── index.js          # React DOM entry point
├── .env.local            # not committed — get from team
├── package.json
└── README.md
```

---

## Onboarding flow (10 steps)

1. **Welcome** — landing + tagline
2. **Privacy** — data commitments
3. **Philosophy** — three principles
4. **Name** — what do people call you?
5. **Self Matrix** — plot yourself: Brave/Fearful × Curious/Judgmental
6. **Matrix Pause** — task card, come back when done
7. **Pricing** — membership ($5/month trial)
8. **Brave Reflect** — what would a brave career decision look like?
9. **Fears Reflect** — what's in the way?
10. **Heart Pause** — terminal screen, reflections sent to Discord

---

## Roadmap

| Milestone | Description | Status |
|-----------|-------------|--------|
| M1 | Vercel auto-deploy on push | ✅ Done |
| M2 | Supabase backend — auth + database | ✅ Done |
| M3 | Matrix UX improvements | ✅ Done |
| M4 | Coach dashboard + analytics | 🔄 In progress |
| M5 | End-to-end flow: sign up → matrix → dashboard | 🔜 |
| M6 | Ship to real users — phone/email collection | 🔜 |
| M7 | Multi-tenant white-label infrastructure | 🔜 |

---

## Deploying

Vercel auto-deploys on every push to `main`. No manual steps.

```bash
git add .
git commit -m "your message"
git push origin main
# live in ~60s
```

---

## Want to contribute?

High-leverage areas right now:
- **Multi-tenant theming** — make white-labeling a first-class feature
- **Coach dashboard** — better analytics, user management
- **Component refactor** — `App.jsx` is ~1600 lines, ripe for splitting
- **Auth hardening** — magic link / phone OTP via Supabase

Open an issue or ping [@chieffhiwa](https://github.com/chieffhiwa) directly.
