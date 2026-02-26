/**
 * Shared validation utilities.
 * Used by both frontend (settings page) and backend (change-password API).
 */

const PASSWORD_RULES = {
  minLength: 8,
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  digit: /[0-9]/,
  special: /[!@#$%^&*]/,
} as const;

/**
 * Validate a new password against security requirements.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateNewPassword(password: string): string | null {
  if (password.length < PASSWORD_RULES.minLength)
    return "Minimal 8 karakter.";
  if (!PASSWORD_RULES.uppercase.test(password))
    return "Minimal 1 huruf besar (A-Z).";
  if (!PASSWORD_RULES.lowercase.test(password))
    return "Minimal 1 huruf kecil (a-z).";
  if (!PASSWORD_RULES.digit.test(password))
    return "Minimal 1 angka (0-9).";
  if (!PASSWORD_RULES.special.test(password))
    return "Minimal 1 karakter khusus (!@#$%^&*).";
  return null;
}

/** Human-readable description of password requirements. */
export const PASSWORD_HINT =
  "Minimal 8 karakter, 1 huruf besar (A-Z), 1 huruf kecil (a-z), 1 angka (0-9), 1 karakter khusus (!@#$%^&*).";
