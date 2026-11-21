// Sign-up form logic. The payload holds email, role, school, plan and consent, and nothing else. It is posted to the form
// service in site.json signup_endpoint (Formspree, decision 0012) with Formspree's honeypot field _gotcha, which people
// leave empty. No third-party script is loaded: the page posts JSON with fetch and reads the JSON reply.
export const ROLES = ["investor", "student", "instructor", "other"];
export const PLANS = ["free", "plus"]; // the form's plan choices (Scheduler is not offered; issue 239)
// The School field shows only for these roles (issue 239).
export const showsSchool = (role) => role === "student" || role === "instructor";
export const MAX = { email: 254, role: 40, school: 120, plan: 40 }; // field lengths (role and plan values fit 40)

// ?plan= and ?role= preselect the form; unknown values are ignored.
export function parseParams(search) {
  const p = new URLSearchParams(search || "");
  const plan = (p.get("plan") || "").toLowerCase(), role = (p.get("role") || "").toLowerCase();
  return { plan: PLANS.includes(plan) ? plan : "", role: ROLES.includes(role) ? role : "" };
}

export function buildSignupPayload(f = {}) {
  return {
    email: String(f.email ?? "").trim().slice(0, MAX.email),
    role: String(f.role ?? "").trim().slice(0, MAX.role),
    school: String(f.school ?? "").trim().slice(0, MAX.school),
    plan: String(f.plan ?? "").trim().slice(0, MAX.plan),
    consent: f.consent === true,
  };
}

// -> { field: message }. Messages say what to fix.
export function validateSignup(p) {
  const e = {};
  if (!p.email) e.email = "Enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) e.email = "That email address looks incomplete. Check for a missing @ or domain.";
  if (!ROLES.includes(p.role)) e.role = "Choose the role that fits you best.";
  if (!PLANS.includes(p.plan)) e.plan = "Choose a plan you are interested in.";
  if (!p.consent) e.consent = "Tick the box so we can email you.";
  return e;
}

/** The exact body posted: the five fields plus the honeypot (empty for people). */
export const signupBody = (payload, gotcha = "") => ({ ...buildSignupPayload(payload), _gotcha: String(gotcha ?? "") });

// Sends nothing without an https endpoint. Reads Formspree's JSON reply: { ok: true } on success, { errors: [...] } on
// failure. Returns { sent, reason? }; a network failure throws (the page shows a retry message).
export async function submitSignup(payload, endpoint, fetchFn = globalThis.fetch, gotcha = "") {
  if (!endpoint || !/^https:\/\//.test(endpoint)) return { sent: false, reason: "no-endpoint" };
  const res = await fetchFn(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(signupBody(payload, gotcha)),
  });
  let reply = null;
  try { reply = await res.json(); } catch { /* a reply that is not JSON */ }
  if (!res.ok || (reply && (reply.ok === false || Array.isArray(reply.errors) && reply.errors.length))) return { sent: false, reason: "http-" + res.status };
  return { sent: true };
}

/** What the page shows after a try: { done } swaps the form for the thank-you card; else `text` is a plain retry line. */
export function signupOutcome(r) {
  if (r && r.sent) return { done: true, text: "Thanks, you’re on the list." };
  if (r && r.reason === "no-endpoint") return { done: false, text: "Sign-ups are paused for a moment. Nothing was sent." };
  return { done: false, text: "That didn’t go through. Please check your connection and try again in a moment." };
}

// While the form has no endpoint, a mailto link to the site's contact address (only when one is set). Nothing is sent by the page.
export function mailtoJoin(email, plan = "") {
  if (typeof email !== "string" || !/^[^\s@?&]+@[^\s@?&]+\.[^\s@?&]+$/.test(email.trim())) return "";
  const what = PLANS.includes(plan) && plan !== "free" ? `the ${plan[0].toUpperCase()}${plan.slice(1)} list` : "the list";
  return `mailto:${email.trim()}?subject=${encodeURIComponent("Join " + what)}`;
}
