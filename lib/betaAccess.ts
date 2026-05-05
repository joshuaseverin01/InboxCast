export function getBetaAllowedEmails() {
  return (process.env.BETA_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function hasBetaAllowlist() {
  return getBetaAllowedEmails().length > 0;
}

export function isEmailAllowedForBeta(email?: string | null) {
  const allowedEmails = getBetaAllowedEmails();
  if (allowedEmails.length === 0) return true;
  if (!email) return false;

  return allowedEmails.includes(email.trim().toLowerCase());
}
