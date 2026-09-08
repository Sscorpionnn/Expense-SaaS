import { test, expect } from "@playwright/test";
import { API_URL, readCsrfToken, registerVerifyAndLogin, uniqueUser } from "./helpers";

/**
 * Ownership-scoping / IDOR check, mirroring the convention already
 * established for account-deletion requests (apps/api/test/account-deletion.e2e-spec.ts):
 * a resource that doesn't belong to the requesting user must come back as a
 * plain 404 ("not found"), never a 403 ("forbidden", which would confirm the
 * id exists) and never the other user's data.
 */
test("a user cannot read another user's account by id", async ({ browser }) => {
  const owner = uniqueUser("idor-owner");
  const attacker = uniqueUser("idor-attacker");

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await registerVerifyAndLogin(ownerPage, owner);

  const csrfToken = await readCsrfToken(ownerPage);
  const createRes = await ownerPage.request.post(`${API_URL}/accounts`, {
    headers: { "x-csrf-token": csrfToken },
    data: {
      name: "Owner's checking",
      type: "BANK",
      currency: "USD",
      initialBalanceMinor: "10000",
    },
  });
  expect(createRes.ok()).toBe(true);
  const account = (await createRes.json()) as { id: string };
  await ownerContext.close();

  const attackerContext = await browser.newContext();
  const attackerPage = await attackerContext.newPage();
  await registerVerifyAndLogin(attackerPage, attacker);

  const attackRes = await attackerPage.request.get(`${API_URL}/accounts/${account.id}`);
  expect(attackRes.status()).toBe(404);

  const listRes = await attackerPage.request.get(`${API_URL}/accounts`);
  const list = (await listRes.json()) as { items: { id: string }[] };
  expect(list.items.some((item) => item.id === account.id)).toBe(false);

  await attackerContext.close();
});
