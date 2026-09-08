import { test, expect } from "@playwright/test";
import { API_URL, readCsrfToken, registerVerifyAndLogin, uniqueUser } from "./helpers";

/**
 * One long, ordered flow against a single user and a single page/context:
 * register -> verify by email -> log in -> create an account -> create a
 * transaction against it -> see it reflected on the dashboard -> create a
 * budget -> export and download a CSV. Each step depends on state the
 * previous step created, so it's one test rather than several independent
 * ones (each `test()` gets a fresh, unauthenticated context).
 */
test("core money-tracking flow", async ({ page }) => {
  const user = uniqueUser("happy-path");

  await test.step("register, verify by email, and log in", async () => {
    await registerVerifyAndLogin(page, user);
    await expect(page.getByRole("heading", { name: /^Welcome/ })).toBeVisible();
  });

  await test.step("create a financial account", async () => {
    await page.goto("/dashboard/accounts");
    await page.getByRole("button", { name: "New account" }).click();
    await page.getByLabel("Name").fill("Checking");
    await page.getByLabel("Starting balance").fill("500");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByRole("heading", { name: "Checking" })).toBeVisible();
    await expect(page.getByText(/500\.00/)).toBeVisible();
  });

  await test.step("create an expense transaction against it", async () => {
    // No UI exists for category management — create the one this test needs
    // directly against the API, then reload so the transaction form's
    // category dropdown (populated via a client-side query) picks it up.
    const csrfToken = await readCsrfToken(page);
    const categoryRes = await page.request.post(`${API_URL}/categories`, {
      headers: { "x-csrf-token": csrfToken },
      data: { name: "Groceries", type: "EXPENSE" },
    });
    expect(categoryRes.ok()).toBe(true);

    await page.goto("/dashboard/transactions");
    await page.reload();

    await page.getByRole("button", { name: "New transaction" }).click();
    await page.getByLabel("Account").click();
    await page.getByRole("option", { name: /Checking/ }).click();
    await page.getByLabel("Category").click();
    await page.getByRole("option", { name: "Groceries" }).click();
    await page.getByLabel(/^Amount/).fill("50");
    await page.getByLabel("Description").fill("Groceries run");
    await page.getByRole("button", { name: "Save transaction" }).click();

    await expect(page.getByText("Groceries run")).toBeVisible();
  });

  await test.step("see it reflected on the dashboard", async () => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
    await expect(page.getByText("Groceries run")).toBeVisible();
    // Starting balance 500.00 minus a 50.00 expense.
    await expect(page.getByText(/450\.00/)).toBeVisible();
  });

  await test.step("create a budget", async () => {
    await page.goto("/dashboard/budgets");
    await page.getByRole("button", { name: "New budget" }).click();
    await page.getByLabel("Name").fill("Groceries budget");
    await page.getByLabel("Amount").fill("300");
    await page.getByRole("button", { name: "Create budget" }).click();

    await expect(page.getByRole("heading", { name: "Groceries budget" })).toBeVisible();
  });

  await test.step("export transactions to CSV and download it", async () => {
    await page.goto("/dashboard/settings");
    await page.getByRole("button", { name: "Request export" }).click();

    const downloadLink = page.getByRole("link", { name: "Download CSV" });
    // Export generation runs async on the worker via a queue — give it room.
    await expect(downloadLink).toBeVisible({ timeout: 60_000 });

    const downloadPromise = page.waitForEvent("download");
    await downloadLink.click();
    const download = await downloadPromise;

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const csv = Buffer.concat(chunks).toString("utf-8");

    expect(csv.split("\n")[0]).toMatch(/date|amount|description/i);
    expect(csv).toContain("Groceries run");
  });
});
