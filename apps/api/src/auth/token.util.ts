import { randomBytes, createHash } from "node:crypto";

/** Generates a high-entropy opaque token for sessions / verification links. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Tokens are already random and high-entropy, so a fast hash (sha256) is
 * appropriate here — unlike passwords, they don't need a slow/memory-hard
 * hash to resist brute force. */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function hashIdentifier(value: string): string {
  return createHash("sha256").update(value.toLowerCase()).digest("hex");
}
