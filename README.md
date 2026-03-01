# cove.
> *your career, your current*

A mobile-first career coaching app. A system for building the career you actually want — generously, honestly, with people you actually like.

---

## What it is

Cove helps you manage your job search with intention. Not a job board. Not a tracker. It starts with **you** — where you actually sit as a person — then surfaces what you're really chasing, then helps you build relationships with the people who can get you there.

Built on three ideas:
- **Go-Giver first** — show up with something to offer
- **Careers over cash** — the right fit pays you back in ways money can't count
- **Generous enthusiasm** — the energy you bring is part of the pitch

---

## Stack

- React 18
- Zero external libraries
- Inline styles throughout
- Hooks only: `useState`, `useEffect`, `useRef`
- Mobile-first, max-width 480px

---

## Getting started

```bash
git clone https://github.com/YOUR_USERNAME/cove.git
cd cove
npm install
npm start
```

Opens at `http://localhost:3000`. Best viewed in Chrome DevTools mobile view (iPhone 14 Pro).

---

## Structure

```
cove/
├── public/
│   └── index.html
├── src/
│   ├── App.jsx       # entire app — onboarding + main
│   └── index.js      # entry point
├── .gitignore
├── package.json
└── README.md
```

### App.jsx — two phases

**Onboarding (7 steps)**
1. Welcome
2. Philosophy
3. Name
4. Self matrix — plot yourself (Brave/Fearful × Curious/Judgmental), get a read on what environments fit you
5. Values — name the feeling underneath the want
6. Add your first connection
7. Place them on the matrix

**Main app (4 tabs)**
- Home — dashboard with values snapshot + connections
- Values — grouped wants with reflections
- Matrix — you and your people on the same grid
- Vibes — motivational anchor

---

## Extending it

**Add persistent storage**
Replace `useState` in the root `App` component with a hook that syncs to `localStorage` or a backend. The `userData` shape is simple JSON.

**Add a scorecard**
Rate companies against your values. The Y/N/M pattern from the original spreadsheet system maps cleanly onto the existing values data model.

**Pull from LinkedIn**
The contact shape already matches LinkedIn profile data. Wire up OAuth and map the response to `{ first, last, role, company, location, mutual }`.

**Go native**
The component logic is framework-agnostic. Port to React Native by swapping `div` → `View`, `p` → `Text`, `input` → `TextInput`. Main effort is about 4-6 hours for someone familiar with RN.

---

## Philosophy

The coaching layer lives in the "go deeper" accordion sections on each contact page. Right now they're static. The next version should personalize them based on the user's own values — e.g. *"This person works somewhere that scored high on your Legacy values. Lead with that."*

---

*See `Cove-Engineering-Notes.docx` for full architecture notes, component breakdown, data model, and engineering handoff documentation.*
