// Cryptographically-adequate-enough temporary password: readable-ish,
// generated client-side just for convenience -- the admin is expected to
// relay it out-of-band, and the employee should change it on first login.
export function generatePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "").slice(0, 14);
}
