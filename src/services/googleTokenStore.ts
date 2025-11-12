/**
 * In-memory store for Google OAuth access tokens keyed by user email.
 * Tokens are cached after the initial Google login to avoid repeated authentication prompts.
 */

interface TokenEntry {
  accessToken: string;
  expiresAt: number | null;
  updatedAt: number;
}

const tokenStore = new Map<string, TokenEntry>();

const normalizeEmail = (email: string = ""): string =>
  email.trim().toLowerCase();

interface StoreTokenOptions {
  expiresInSeconds?: number | null;
}

export const storeGoogleToken = (
  email: string,
  accessToken: string,
  { expiresInSeconds = null }: StoreTokenOptions = {},
): TokenEntry => {
  if (!email || !accessToken) {
    throw new Error(
      "Email and access token are required to store Google credentials.",
    );
  }

  const normalizedEmail = normalizeEmail(email);
  const entry: TokenEntry = {
    accessToken,
    expiresAt:
      typeof expiresInSeconds === "number" && expiresInSeconds > 0
        ? Date.now() + expiresInSeconds * 1000
        : null,
    updatedAt: Date.now(),
  };

  tokenStore.set(normalizedEmail, entry);

  return entry;
};

export const getGoogleToken = (email: string): string | null => {
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

export const clearGoogleToken = (email: string): void => {
  if (!email) {
    return;
  }
  tokenStore.delete(normalizeEmail(email));
};

export const hasGoogleToken = (email: string): boolean =>
  getGoogleToken(email) !== null;

export const resetTokenStore = (): void => {
  tokenStore.clear();
};
