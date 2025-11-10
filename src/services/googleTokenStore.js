/**
 * In-memory store for Google OAuth access tokens keyed by user email.
 * Tokens are cached after the initial Google login to avoid repeated authentication prompts.
 */

const tokenStore = new Map();

const normalizeEmail = (email = '') => email.trim().toLowerCase();

export const storeGoogleToken = (email, accessToken, { expiresInSeconds = null } = {}) => {
  if (!email || !accessToken) {
    throw new Error('Email and access token are required to store Google credentials.');
  }

  const normalizedEmail = normalizeEmail(email);
  const entry = {
    accessToken,
    expiresAt:
      typeof expiresInSeconds === 'number' && expiresInSeconds > 0
        ? Date.now() + expiresInSeconds * 1000
        : null,
    updatedAt: Date.now(),
  };

  tokenStore.set(normalizedEmail, entry);

  return entry;
};

export const getGoogleToken = (email) => {
  if (!email) {
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  const entry = tokenStore.get(normalizedEmail);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt && entry.expiresAt <= Date.now()) {
    tokenStore.delete(normalizedEmail);
    return null;
  }

  return entry.accessToken;
};

export const clearGoogleToken = (email) => {
  if (!email) {
    return;
  }
  tokenStore.delete(normalizeEmail(email));
};

export const hasGoogleToken = (email) => getGoogleToken(email) !== null;

export const resetTokenStore = () => {
  tokenStore.clear();
};
