import { generateOpaqueToken, hashIdentifier, hashToken } from "./token.util";

describe("token.util", () => {
  it("generates unique, high-entropy tokens", () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it("hashes tokens deterministically", () => {
    const token = generateOpaqueToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("produces different hashes for different tokens", () => {
    expect(hashToken(generateOpaqueToken())).not.toBe(hashToken(generateOpaqueToken()));
  });

  it("hashIdentifier is case-insensitive (for consistent email hashing)", () => {
    expect(hashIdentifier("User@Example.com")).toBe(hashIdentifier("user@example.com"));
  });
});
