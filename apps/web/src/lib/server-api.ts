import "server-only";
import { cookies } from "next/headers";
import type { UserProfile } from "@expense-saas/types";

function apiBaseUrl(): string {
  const url = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("API_URL is not set");
  return url;
}

/**
 * Server-side DAL: forwards the incoming request's cookies to the API, since
 * fetch() on the server has no browser cookie jar of its own. Session
 * validation itself always happens on the API (opaque token + Redis/DB
 * lookup) — this never trusts anything read from the cookie locally.
 */
export async function getServerSession(): Promise<UserProfile | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) return null;

  try {
    const res = await fetch(`${apiBaseUrl()}/auth/me`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    });

    if (!res.ok) return null;
    const body = (await res.json()) as { user: UserProfile };
    return body.user;
  } catch {
    // API unreachable — fail closed (treat as signed out) rather than 500.
    return null;
  }
}
