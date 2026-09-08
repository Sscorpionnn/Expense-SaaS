import * as argon2 from "argon2";

export async function hashPassword(rawPassword: string): Promise<string> {
  return argon2.hash(rawPassword, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, rawPassword: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, rawPassword);
  } catch {
    return false;
  }
}
