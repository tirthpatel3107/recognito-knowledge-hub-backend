/**
 * MongoDB Service Utilities
 */

/**
 * Normalize Gmail addresses for comparison
 * Gmail treats dots as equivalent and ignores everything after +
 */
export const normalizeGmailAddress = (email: string): string => {
  if (!email || typeof email !== "string") {
    return email;
  }

  const lowerEmail = email.toLowerCase().trim();
  const [localPart, domain] = lowerEmail.split("@");

  // Only normalize if it's a Gmail domain
  if (domain === "gmail.com" || domain === "googlemail.com") {
    // Remove dots from local part
    const normalizedLocal = localPart.replace(/\./g, "");
    // Remove everything after + (plus aliases)
    const withoutPlus = normalizedLocal.split("+")[0];
    return `${withoutPlus}@${domain}`;
  }

  // For non-Gmail addresses, just return lowercase
  return lowerEmail;
};

