import { expect, type APIRequestContext, type Page } from "@playwright/test";

const MAILDEV_URL = process.env.PLAYWRIGHT_MAILDEV_URL ?? "http://localhost:1080";
export const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

interface MaildevMessage {
  to?: { address: string }[];
  html: string;
  text: string;
  time: string;
}

async function fetchLatestEmail(
  request: APIRequestContext,
  toAddress: string,
): Promise<MaildevMessage> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const res = await request.get(`${MAILDEV_URL}/email`);
    const messages = (await res.json()) as MaildevMessage[];
    const matches = messages.filter((m) => m.to?.some((t) => t.address === toAddress));
    if (matches.length > 0) {
      return matches.sort((a, b) => Date.parse(b.time) - Date.parse(a.time))[0]!;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No email received for ${toAddress} within timeout`);
}

/** Pulls the verify-email/reset-password link out of a Maildev message body. */
function extractLink(message: MaildevMessage, pathname: string): string {
  const source = message.html || message.text;
  // pathname is always a literal passed by this file's own call sites, never
  // attacker-controlled input.
  // eslint-disable-next-line security/detect-non-literal-regexp
  const pattern = new RegExp(`https?://\\S*${pathname}\\?token=[^"\\s<]+`);
  const match = pattern.exec(source);
  if (!match) throw new Error(`Could not find a ${pathname} link in the email`);
  return match[0].replace(/&amp;/g, "&");
}

export interface RegisteredUser {
  email: string;
  password: string;
  name: string;
}

/** A fresh, high-entropy identity — safe to register concurrently across spec files. */
export function uniqueUser(prefix: string): RegisteredUser {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `${prefix}-${unique}@example.com`,
    password: "correct horse battery staple 42",
    name: `${prefix} Test User`,
  };
}

/** Registers via the UI and verifies via the real Maildev-delivered email. Does not log in. */
export async function registerAndVerify(page: Page, user: RegisteredUser): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  const message = await fetchLatestEmail(page.request, user.email);
  const verifyUrl = extractLink(message, "/verify-email");

  await page.goto(verifyUrl);
  await expect(page.getByText("Email verified")).toBeVisible();
}

export async function login(page: Page, user: RegisteredUser): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/dashboard");
}

/** Registers via the UI, verifies via the real Maildev-delivered email, then logs in. */
export async function registerVerifyAndLogin(page: Page, user: RegisteredUser): Promise<void> {
  await registerAndVerify(page, user);
  await login(page, user);
}

/** Reads the CSRF token half out of the browser's double-submit cookie (see api-client.ts). */
export async function readCsrfToken(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const csrf = cookies.find((c) => c.name === "esaas_csrf");
  if (!csrf) throw new Error("esaas_csrf cookie not set — is the user logged in?");
  return decodeURIComponent(csrf.value).split(".")[0]!;
}
