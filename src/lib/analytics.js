// ─── ANALYTICS ────────────────────────────────────────────────────────────────
// PostHog is initialised once here. The `track` helper is safe to call even
// when the key is absent (e.g. local dev without a .env file).

import posthog from "posthog-js";

export const PH_KEY = process.env.REACT_APP_POSTHOG_KEY;
if (PH_KEY) {
  posthog.init(PH_KEY, {
    api_host: "https://us.i.posthog.com",
    person_profiles: "identified_only",
  });
}

export { posthog };

export const track = (event, props) => {
  if (PH_KEY) posthog.capture(event, props);
};
