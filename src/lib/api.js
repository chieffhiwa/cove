// ─── SUPABASE API LAYER ───────────────────────────────────────────────────────
//
// Hey Simon — this is the file where all Supabase calls live.
// Here's a quick map of the tables this app touches:
//
//  profiles          – one row per user; stores name, email, matrix position,
//                      reflections, and contacts array.  Upserted on conflict
//                      by email.
//
//  reflections       – append-only log of brave/fears reflections submitted
//                      at the end of onboarding.  Also pinged to Discord.
//
//  matrix_sessions   – lightweight log: every time a user places their dot we
//                      insert a row (name, x, y, quadrant, ref).  Used for the
//                      "where others landed" stats on the matrix pause screen.
//
//  user_matrix_scores – per-user bravery/curiosity/archetype scores.  Written
//                       during sign-up and updated as users answer Coach
//                       questions (CoachTab → submitQuestion).
//
//  onboarding_answers – stores the brave/fears text tied to a Supabase user_id.
//
//  questions          – Q&A bank for the Coach tab.  Each row has a layer,
//                       sort_order, body, input_type, options (JSONB), and
//                       optional hook_after text.
//
//  user_answers       – records each answer a user submits in the Coach tab.
//                       Used to drive the matching algorithm.
//
//  similar_minds      – a Supabase view (or materialised table) that pairs
//                       users by similarity_score and overlap_count.  Queried
//                       in MatchesTab.  Simon: this is where the matching logic
//                       should live — either as a Postgres function, a cron
//                       edge function, or a view.
//
// All calls use the singleton `supabase` client from src/supabase.js.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "../supabase";
import { getQuadrant } from "../config/quadrants";
import { QUADRANT_READS } from "../config/quadrants";

// Discord webhook — used by postReflections to notify the team
const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1477427861706117265/mewcLc9XgpBYM10AiQQl3lpY016KvrmI1sc897YD2yYQJL78TTqVu73lbDrsHbrgwK5i";

// ── upsertProfile ─────────────────────────────────────────────────────────────
// Writes (or updates) a row in `profiles` for the current user.
// Called at the end of onboarding (finish()) and when the user edits their
// email on the Profile tab.
export async function upsertProfile(userData) {
  const quadrant = userData.selfPosition ? getQuadrant(userData.selfPosition.x, userData.selfPosition.y) : null;
  const quadrantLabel = quadrant ? QUADRANT_READS[quadrant]?.title : null;
  const ref = localStorage.getItem("cove_ref") || null;
  const { data, error } = await supabase.from("profiles").upsert({
    name: userData.name || null,
    email: userData.email || null,
    quadrant: quadrantLabel,
    x: userData.selfPosition?.x ?? null,
    y: userData.selfPosition?.y ?? null,
    brave_reflection: userData.braveReflection || null,
    fears_reflection: userData.fearsReflection || null,
    contacts: userData.contacts || [],
    ref,
    updated_at: new Date().toISOString(),
  }, { onConflict: "email", ignoreDuplicates: false });
  if (data?.[0]?.id) localStorage.setItem("cove_profile_id", data[0].id);
  return { data, error };
}

// ── postReflections ───────────────────────────────────────────────────────────
// Fire-and-forget: inserts a row into `reflections` AND pings the Discord
// channel with the user's brave/fears text.  Called once at the end of the
// fears reflection step (step 13).
export function postReflections({ name, email, selfPosition, braveReflection, fearsReflection, wants = [] }) {
  const quadrant = selfPosition ? getQuadrant(selfPosition.x, selfPosition.y) : null;
  const quadrantLabel = quadrant ? QUADRANT_READS[quadrant]?.title : "Unknown";
  const wantsSummary = wants.filter(w => w.feeling).map(w => `${w.feeling}: ${w.text}`).join("\n") || "_(none tagged)_";
  const ref = localStorage.getItem("cove_ref") || null;

  // Save to Supabase
  supabase.from("reflections").insert({
    name: name || null,
    phone: email || null,
    ref: ref,
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
          { name: "📧 Email", value: email || "_(not provided)_", inline: true },
          { name: "🔗 Ref", value: ref || "_(direct)_", inline: true },
          { name: "💙 Brave decision", value: braveReflection || "_(no response)_" },
          { name: "🌊 What's in the way", value: fearsReflection || "_(no response)_" },
          { name: "✨ What they want", value: wantsSummary },
        ],
        footer: { text: `cove · your career. your current.` },
        timestamp: new Date().toISOString(),
      }],
    }),
  }).catch(() => {}); // fire and forget — don't block the user
}
