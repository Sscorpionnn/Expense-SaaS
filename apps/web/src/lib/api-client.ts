"use client";

import { SESSION } from "@expense-saas/config";
import type { ApiErrorBody } from "@expense-saas/types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, string[]>;

  constructor(body: ApiErrorBody, status: number) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

function apiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL is not set");
  return url;
}

function readCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(name.length + 1));
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Ensures the double-submit CSRF cookie exists, then returns its token half. */
export async function ensureCsrfToken(): Promise<string> {
  const existing = readCookie(SESSION.CSRF_COOKIE_NAME);
  if (existing) return existing.split(".")[0] ?? "";

  await fetch(`${apiBaseUrl()}/auth/csrf`, { credentials: "include" });
  const issued = readCookie(SESSION.CSRF_COOKIE_NAME);
  return issued?.split(".")[0] ?? "";
}

interface ApiFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
}

/** Client-side fetch wrapper: same-origin credentials, CSRF header, typed errors. */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {};

  if (!SAFE_METHODS.has(method)) {
    headers[SESSION.CSRF_HEADER_NAME] = await ensureCsrfToken();
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${apiBaseUrl()}${path}`, {
    method,
    credentials: "include",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await res.json() : undefined;

  if (!res.ok) {
    throw new ApiError(
      payload ?? { statusCode: res.status, message: res.statusText, code: "ERROR" },
      res.status,
    );
  }

  return payload as T;
}
