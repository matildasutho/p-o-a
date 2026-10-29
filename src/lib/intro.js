// Set once the home intro loader has finished, as a session cookie (no
// expiry, so it clears when the browser closes). Lives outside the client
// component so the server page can read the real value.
export const INTRO_SEEN_COOKIE = "poa-intro-seen";
