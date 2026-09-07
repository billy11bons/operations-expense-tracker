// Stage 2 browser smoke check. A full acceptance report belongs to stage 3.
// Run with Node and the path to the bundled playwright package as the first argument.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || "playwright");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const artifacts = path.join(root, "verification", "stage-02");
await mkdir(artifacts, { recursive: true });
const results = [];
const errors = [];
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "America/New_York" });
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
const key = "case01.operationsExpenseTracker.v1";
const origin = "http://127.0.0.1:3000";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
async function check(name, action) {
  try { await action(); results.push({ name, result: "PASS" }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, result: "FAIL", error: error.message }); throw error; }
}
const storage = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
async function navigate(name, heading) {
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name, exact: true }).click();
  await page.getByRole("heading", { name: heading, exact: true }).waitFor();
}
let failure;
try {
  await check("First load, demo data and Dashboard", async () => {
    const response = await page.goto(origin);
    assert.equal(response.status(), 200);
    await page.getByRole("heading", { name: "Dashboard", exact: true }).waitFor();
    await page.getByTestId("weekly-total").waitFor();
    assert.equal(await page.getByTestId("weekly-total").textContent(), "177.50 USD");
    assert.equal(await page.getByTestId("pending-count").textContent(), "2");
    assert.equal(await page.getByTestId("overdue-count").textContent(), "1");
    assert.equal(await page.getByTestId("completed-count").textContent(), "1");
    const data = await storage(); assert.equal(data.expenses.length, 4); assert.equal(data.tasks.length, 5);
    await page.screenshot({ path: path.join(artifacts, "FIRST_RUN_DESKTOP.png"), fullPage: true });
  });
  await check("Expense create, edit, reload and weekly total", async () => {
    await navigate("Expenses", "Expenses");
    await page.getByRole("button", { name: "+ Add expense", exact: true }).click();
    await page.getByLabel("Description *", { exact: true }).fill("Smoke expense");
    await page.getByLabel("Date *", { exact: true }).fill(today());
    await page.getByLabel("Amount (USD) *", { exact: true }).fill("10.10");
    await page.getByLabel("Note", { exact: true }).fill("Temporary smoke data");
    await page.getByRole("button", { name: "Save expense", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal((await storage()).expenses.find(e => e.description === "Smoke expense").amountMinor, 1010);
    await page.getByRole("button", { name: "Edit expense Smoke expense", exact: true }).click();
    await page.getByLabel("Amount (USD) *", { exact: true }).fill("12,10");
    await page.getByRole("button", { name: "Save expense", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.reload();
    await page.getByRole("button", { name: "Edit expense Smoke expense", exact: true }).waitFor();
    assert.equal((await storage()).expenses.find(e => e.description === "Smoke expense").amountMinor, 1210);
    await navigate("Dashboard", "Dashboard");
    assert.equal(await page.getByTestId("weekly-total").textContent(), "189.60 USD");
  });
  await check("Expense deletion cancellation and confirmation", async () => {
    await navigate("Expenses", "Expenses");
    await page.getByRole("button", { name: "Delete expense Smoke expense", exact: true }).click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.ok((await storage()).expenses.some(e => e.description === "Smoke expense"));
    await page.getByRole("button", { name: "Delete expense Smoke expense", exact: true }).click();
    await page.getByRole("button", { name: "Delete record", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal((await storage()).expenses.length, 4);
  });
  await check("Expense filters and reset", async () => {
    await page.getByLabel("Category", { exact: true }).selectOption({ label: "Supplies" });
    await page.getByRole("button", { name: "Apply filters", exact: true }).click();
    assert.equal(await page.locator("tbody tr").count(), 1);
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    assert.equal(await page.locator("tbody tr").count(), 4);
  });
  await check("Task create, edit, status and delete", async () => {
    await navigate("Tasks", "Tasks");
    await page.getByRole("button", { name: "+ Add task", exact: true }).click();
    await page.getByLabel("Task *", { exact: true }).fill("Smoke task");
    await page.getByLabel("Owner", { exact: true }).fill("Tester");
    await page.getByLabel("Status *", { exact: true }).selectOption("Pending");
    await page.getByLabel("Priority *", { exact: true }).selectOption("High");
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Edit task Smoke task", exact: true }).click();
    await page.getByLabel("Owner", { exact: true }).fill("Updated tester");
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.getByLabel("Status for Smoke task", { exact: true }).selectOption("Done");
    const task = (await storage()).tasks.find(t => t.task === "Smoke task");
    assert.equal(task.owner, "Updated tester"); assert.equal(task.status, "Done");
    await page.getByRole("button", { name: "Delete task Smoke task", exact: true }).click();
    await page.getByRole("button", { name: "Delete record", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal((await storage()).tasks.length, 5);
  });
  await check("Task filters and Pending / overdue labels", async () => {
    await page.getByLabel("Status", { exact: true }).selectOption("Pending");
    await page.getByLabel("Priority", { exact: true }).selectOption("High");
    assert.equal(await page.locator("tbody tr").count(), 1);
    assert.equal(await page.locator("tbody .badge.pending").count(), 1);
    assert.equal(await page.locator("tbody .badge.overdue").count(), 1);
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    assert.equal(await page.locator("tbody tr").count(), 5);
  });
  await check("Category create and availability after reload", async () => {
    await navigate("Categories", "Expense categories");
    await page.getByLabel("Category name *", { exact: true }).fill("Smoke category");
    await page.getByRole("button", { name: "Add category", exact: true }).click();
    await page.getByRole("status").waitFor();
    await page.reload();
    await page.getByRole("heading", { name: "Expense categories", exact: true }).waitFor();
    assert.ok((await storage()).categories.some(c => c.name === "Smoke category"));
    await navigate("Expenses", "Expenses");
    await page.getByLabel("Category", { exact: true }).selectOption({ label: "Smoke category" });
    await page.getByRole("button", { name: "Apply filters", exact: true }).click();
    await page.getByText("No expenses match these filters.", { exact: false }).waitFor();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
  });
  await check("Basic form validation", async () => {
    await page.getByRole("button", { name: "+ Add expense", exact: true }).click();
    await page.getByLabel("Amount (USD) *", { exact: true }).fill("-1");
    await page.getByRole("button", { name: "Save expense", exact: true }).click();
    assert.equal(await page.locator("#description[aria-invalid=true]").count(), 1);
    assert.equal(await page.locator("#amount[aria-invalid=true]").count(), 1);
    assert.equal((await storage()).expenses.length, 4);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
  });
  await check("Mobile routes and form fit at 390px", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [name, heading] of [["Dashboard", "Dashboard"], ["Expenses", "Expenses"], ["Tasks", "Tasks"], ["Categories", "Expense categories"]]) {
      await navigate(name, heading);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} overflows`);
    }
    await navigate("Expenses", "Expenses");
    await page.getByRole("button", { name: "+ Add expense", exact: true }).click();
    const box = await page.getByRole("dialog").boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 390);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await navigate("Dashboard", "Dashboard");
    await page.screenshot({ path: path.join(artifacts, "FIRST_RUN_MOBILE.png"), fullPage: true });
  });
  await check("No runtime or console errors in smoke flow", async () => assert.deepEqual(errors, []));
} catch (error) {
  failure = error;
  console.error(error);
  await page.screenshot({ path: path.join(artifacts, "SMOKE_FAILURE.png"), fullPage: true }).catch(() => {});
} finally {
  await writeFile(path.join(artifacts, "smoke-results.json"), JSON.stringify({ at: new Date().toISOString(), results, consoleErrors: errors, scope: "Stage 2 smoke; not full stage 3 acceptance" }, null, 2));
  await browser.close();
}
if (failure) process.exitCode = 1;
