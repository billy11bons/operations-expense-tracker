// Stage 3 technical acceptance. Isolated contexts only: never use the user's browser profile.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || "playwright");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(root, "verification", "stage-03");
await mkdir(out, { recursive: true });
const origin = "http://127.0.0.1:3000";
const key = "case01.operationsExpenseTracker.v1";
const results = [];
const consoleErrors = [];
const browser = await chromium.launch({ channel: "msedge", headless: true });
const categories = [{ id: "c0", name: "Supplies" }, { id: "c1", name: "Transport" }];
const expense = (id, date, amountMinor, categoryId = "c0") => ({ id, date, amountMinor, categoryId, description: id, paymentMethod: "Card", note: "Original note" });
const task = (id, dueDate, status, priority = "Medium") => ({ id, dueDate, status, priority, task: id, owner: "Alex", note: "Original note" });
const fixture = () => ({ schemaVersion: 1, initialized: true, categories: structuredClone(categories),
  expenses: [expense("Previous expense", "2026-09-06", 9900), expense("Monday expense", "2026-09-07", 1010), expense("Sunday expense", "2026-09-13", 2020, "c1"), expense("Next expense", "2026-09-14", 8800)],
  tasks: [task("Pending yesterday", "2026-09-08", "Pending", "High"), task("Pending today", "2026-09-09", "Pending"), task("New yesterday", "2026-09-08", "New", "Low"), task("Done yesterday", "2026-09-08", "Done")],
});
const empty = () => ({ ...fixture(), expenses: [], tasks: [] });
const read = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
const button = (page, name) => page.getByRole("button", { name, exact: true });
// Stable form IDs avoid label textContent including an existing textarea value or validation text.
// Accessible names are inspected separately; Next.js also has its own offscreen role=alert announcer.
const fieldIds = { "Description *": "description", "Date *": "date", "Amount (USD) *": "amount", "Category *": "categoryId", "Payment method *": "paymentMethod", "Note": "note", "Task *": "task", "Owner": "owner", "Due date *": "dueDate", "Status *": "status", "Priority *": "priority", "Category name *": "category-name", "From": "from", "To": "to", "Category": "filter-category", "Status": "filter-status", "Priority": "filter-priority" };
const field = (page, name) => fieldIds[name] ? page.locator(`#${fieldIds[name]}`) : page.getByLabel(name, { exact: true });
const appAlert = page => page.locator("p[role=alert]");
async function nav(page, name, heading = name) {
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name, exact: true }).click();
  await page.getByRole("heading", { name: heading, exact: true }).waitFor();
}
async function saved(page, kind) {
  await button(page, `Save ${kind}`).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
}
async function total(page, expected) {
  await nav(page, "Dashboard");
  assert.equal(await page.getByTestId("weekly-total").textContent(), expected);
}
async function fillExpense(page, { description = "Created expense", date = "2026-09-09", amount = "10.10", category = "Supplies", payment = "Cash", note = "Created note" } = {}) {
  await field(page, "Description *").fill(description);
  await field(page, "Date *").fill(date);
  await field(page, "Amount (USD) *").fill(amount);
  await field(page, "Category *").selectOption({ label: category });
  await field(page, "Payment method *").selectOption(payment);
  await field(page, "Note").fill(note);
}
async function fillTask(page, { name = "Created task", owner = "Sam", date = "2026-09-09", status = "New", priority = "High", note = "Created task note" } = {}) {
  await field(page, "Task *").fill(name);
  await field(page, "Owner").fill(owner);
  await field(page, "Due date *").fill(date);
  await field(page, "Status *").selectOption(status);
  await field(page, "Priority *").selectOption(priority);
  await field(page, "Note").fill(note);
}
async function check(id, scenario, expected, fn, { seed = fixture(), time = "2026-09-09T12:00:00-04:00" } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "America/New_York" });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", error => consoleErrors.push({ id, type: "runtime", message: error.message }));
  page.on("console", message => { if (message.type() === "error") consoleErrors.push({ id, type: "console", message: message.text() }); });
  if (seed !== null) await context.addInitScript(({ seed, key }) => {
    if (!sessionStorage.getItem("stage03-fixture-installed")) {
      localStorage.setItem(key, JSON.stringify(seed));
      sessionStorage.setItem("stage03-fixture-installed", "1");
    }
  }, { seed, key });
  await page.clock.install({ time: new Date(time) });
  const started = Date.now();
  try {
    const response = await page.goto(origin);
    assert.equal(response.status(), 200);
    await page.getByRole("heading", { name: "Dashboard", exact: true }).waitFor();
    const actual = await fn(page);
    results.push({ id, scenario, expected, actual, result: "PASS", problem: "Нет", durationMs: Date.now() - started });
    console.log(`PASS ${id}: ${scenario}`);
  } catch (error) {
    results.push({ id, scenario, expected, actual: error.message, result: "FAIL", problem: error.message, durationMs: Date.now() - started });
    console.error(`FAIL ${id}: ${error.message}`);
    await page.screenshot({ path: path.join(out, `${id}-failure.png`), fullPage: true }).catch(() => {});
  } finally { await context.close(); }
}

try {
  await check("T01", "Запуск, четыре маршрута и однократные демоданные", "HTTP 200, 4 расхода и 5 задач; reload не дублирует demo", async page => {
    assert.equal((await read(page)).expenses.length, 4); assert.equal((await read(page)).tasks.length, 5);
    assert.equal(await page.getByTestId("weekly-total").textContent(), "177.50 USD");
    for (const [route, title] of [["/expenses", "Expenses"], ["/tasks", "Tasks"], ["/settings", "Expense categories"], ["/", "Dashboard"]]) {
      assert.equal((await page.goto(origin + route)).status(), 200);
      await page.getByRole("heading", { name: title, exact: true }).waitFor();
    }
    await page.reload(); await page.getByTestId("weekly-total").waitFor();
    assert.equal((await read(page)).expenses.length, 4); assert.equal((await read(page)).tasks.length, 5);
    return "Все 4 URL открылись напрямую; 177.50 USD; после reload 4 расхода и 5 задач.";
  }, { seed: null });

  await check("T02", "Создание расхода со всеми полями и reload", "Сохранены точные значения формы и 1010 центов", async page => {
    await nav(page, "Expenses"); await button(page, "+ Add expense").click(); await fillExpense(page); await saved(page, "expense");
    const e = (await read(page)).expenses.find(e => e.description === "Created expense");
    assert.ok(e.id); assert.deepEqual({ ...e, id: "any" }, { id: "any", description: "Created expense", date: "2026-09-09", amountMinor: 1010, categoryId: "c0", paymentMethod: "Cash", note: "Created note" });
    await page.reload(); await button(page, "Edit expense Created expense").waitFor(); assert.deepEqual((await read(page)).expenses[4], e);
    return "Создан пятый расход: 10.10 USD, Supplies, Cash, дата и note точны; reload сохранил запись.";
  });

  await check("T03", "Редактирование всех полей расхода", "Меняются все поля выбранной записи, остальные записи неизменны", async page => {
    const before = await read(page);
    await nav(page, "Expenses"); await button(page, "Edit expense Monday expense").click();
    await fillExpense(page, { description: "Updated expense", date: "2026-09-10", amount: "12,10", category: "Transport", payment: "Bank transfer", note: "Updated note" }); await saved(page, "expense");
    const after = await read(page);
    assert.deepEqual(after.expenses.find(e => e.id === "Monday expense"), { id: "Monday expense", description: "Updated expense", date: "2026-09-10", amountMinor: 1210, categoryId: "c1", paymentMethod: "Bank transfer", note: "Updated note" });
    assert.deepEqual(after.expenses.filter(e => e.id !== "Monday expense"), before.expenses.filter(e => e.id !== "Monday expense"));
    return "Изменены описание, дата, сумма, категория, способ оплаты и note; ID и соседние записи сохранены.";
  });

  await check("T04", "Удаление расхода: отмена и подтверждение", "Cancel ничего не меняет; Delete удаляет только выбранную запись", async page => {
    const before = await read(page); await nav(page, "Expenses");
    await button(page, "Delete expense Monday expense").click(); await button(page, "Cancel").click(); assert.deepEqual(await read(page), before);
    await button(page, "Delete expense Monday expense").click(); await button(page, "Delete record").click(); await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.deepEqual((await read(page)).expenses, before.expenses.filter(e => e.id !== "Monday expense"));
    return "Отмена сохранила все 4 расхода; подтверждение удалило только Monday expense.";
  });

  await check("T05", "Недельный итог и границы недели после CRUD", "30.30 → 32.30 → 12.10 → 0.00 USD без reload", async page => {
    assert.equal(await page.getByTestId("weekly-total").textContent(), "30.30 USD");
    await nav(page, "Expenses"); await button(page, "Edit expense Monday expense").click(); await field(page, "Amount (USD) *").fill("12.10"); await saved(page, "expense"); await total(page, "32.30 USD");
    await nav(page, "Expenses"); await button(page, "Delete expense Sunday expense").click(); await button(page, "Delete record").click(); await page.getByRole("dialog").waitFor({ state: "hidden" }); await total(page, "12.10 USD");
    await nav(page, "Expenses"); await button(page, "Edit expense Monday expense").click(); await field(page, "Date *").fill("2026-09-14"); await saved(page, "expense"); await total(page, "0.00 USD");
    return "Сегодня 09.09.2026; включены 07–13 сентября, исключены 06/14; получены все четыре ожидаемых итога.";
  });

  await check("T06", "Создание задачи со всеми полями и reload", "Точные task, owner, due date, status, priority, note сохраняются", async page => {
    await nav(page, "Tasks"); await button(page, "+ Add task").click();
    assert.equal(await field(page, "Status *").inputValue(), "New"); assert.equal(await field(page, "Priority *").inputValue(), "Medium");
    await fillTask(page); await saved(page, "task");
    const t = (await read(page)).tasks.find(t => t.task === "Created task");
    assert.ok(t.id); assert.deepEqual({ ...t, id: "any" }, { id: "any", task: "Created task", owner: "Sam", dueDate: "2026-09-09", status: "New", priority: "High", note: "Created task note" });
    await page.reload(); await button(page, "Edit task Created task").waitFor(); assert.deepEqual((await read(page)).tasks[4], t);
    return "Создана пятая задача со всеми полями; значения по умолчанию New/Medium верны; reload сохранил изменения.";
  });

  await check("T07", "Редактирование всех полей задачи", "Изменены поля выбранной задачи; ID и соседние записи сохранены", async page => {
    const before = await read(page); await nav(page, "Tasks"); await button(page, "Edit task Pending yesterday").click();
    await fillTask(page, { name: "Updated task", owner: "Taylor", date: "2026-09-15", status: "In Progress", priority: "Low", note: "Updated task note" }); await saved(page, "task");
    const after = await read(page);
    assert.deepEqual(after.tasks[0], { id: "Pending yesterday", task: "Updated task", owner: "Taylor", dueDate: "2026-09-15", status: "In Progress", priority: "Low", note: "Updated task note" });
    assert.deepEqual(after.tasks.slice(1), before.tasks.slice(1));
    return "Изменены task, owner, dueDate, status, priority и note; остальные 3 задачи неизменны.";
  });

  await check("T08", "Изменение статуса задачи и сохранность остальных полей", "Все четыре статуса доступны, остальные поля не теряются", async page => {
    const before = (await read(page)).tasks[0]; await nav(page, "Tasks");
    for (const status of ["New", "In Progress", "Done", "Pending"]) {
      await field(page, "Status for Pending yesterday").selectOption(status);
      assert.deepEqual((await read(page)).tasks[0], { ...before, status });
    }
    return "Последовательно New, In Progress, Done, Pending; остальные поля идентичны исходным.";
  });

  await check("T09", "Pending, overdue и Done: пересечение и срок сегодня", "Счётчики 2/2/1; после Done — 1/1/2; возврат восстанавливает 2/2/1", async page => {
    const counts = async () => [await page.getByTestId("pending-count").textContent(), await page.getByTestId("overdue-count").textContent(), await page.getByTestId("completed-count").textContent()];
    assert.deepEqual(await counts(), ["2", "2", "1"]);
    await nav(page, "Tasks");
    const yesterday = page.locator("tbody tr").filter({ has: page.getByRole("button", { name: "Edit task Pending yesterday", exact: true }) });
    assert.equal(await yesterday.locator(".pending").count(), 1); assert.equal(await yesterday.locator(".overdue").count(), 1);
    const today = page.locator("tbody tr").filter({ has: page.getByRole("button", { name: "Edit task Pending today", exact: true }) });
    assert.equal(await today.locator(".overdue").count(), 0);
    await field(page, "Status for Pending yesterday").selectOption("Done"); await nav(page, "Dashboard"); assert.deepEqual(await counts(), ["1", "1", "2"]);
    await nav(page, "Tasks"); await field(page, "Status for Pending yesterday").selectOption("Pending"); await nav(page, "Dashboard"); assert.deepEqual(await counts(), ["2", "2", "1"]);
    return "Срок сегодня не просрочен; Pending вчера имеет обе отметки; Done исключён из overdue; счётчики совпали.";
  });

  await check("T10", "Удаление задачи: отмена и подтверждение", "Отмена сохраняет записи; подтверждение удаляет только выбранную", async page => {
    const before = await read(page); await nav(page, "Tasks"); await button(page, "Delete task New yesterday").click(); await button(page, "Cancel").click(); assert.deepEqual(await read(page), before);
    await button(page, "Delete task New yesterday").click(); await button(page, "Delete record").click(); await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.deepEqual((await read(page)).tasks, before.tasks.filter(t => t.id !== "New yesterday"));
    return "Отмена без изменений; подтверждение удалило только New yesterday.";
  });

  await check("T11", "Фильтры расходов: даты, категория, ошибочный период, сброс", "AND и включённые границы; ошибочный период не применяется; Dashboard независим", async page => {
    await nav(page, "Expenses"); await field(page, "From").fill("2026-09-07"); await field(page, "To").fill("2026-09-13"); await button(page, "Apply filters").click(); assert.equal(await page.locator("tbody tr").count(), 2);
    await field(page, "Category").selectOption("c0"); await button(page, "Apply filters").click(); assert.equal(await page.locator("tbody tr").count(), 1);
    await button(page, "Edit expense Monday expense").waitFor();
    await field(page, "From").fill("2026-09-14"); await button(page, "Apply filters").click(); await appAlert(page).waitFor(); assert.equal(await page.locator("tbody tr").count(), 1);
    await total(page, "30.30 USD"); await nav(page, "Expenses"); await button(page, "Reset").click(); assert.equal(await page.locator("tbody tr").count(), 4);
    await field(page, "Category").selectOption("c1"); await button(page, "Apply filters").click(); await page.reload(); await button(page, "+ Add expense").waitFor(); assert.equal(await page.locator("tbody tr").count(), 4);
    return "07–13 сентября: 2 записи; + Supplies: 1; неверный интервал сохранил выборку; reset/reload вернули 4; Dashboard 30.30 USD.";
  });

  await check("T12", "Фильтры задач: все сочетания статуса и приоритета", "12 сочетаний совпадают с исходными данными, reset возвращает 4 задачи", async page => {
    await nav(page, "Tasks");
    for (const status of ["New", "In Progress", "Pending", "Done"]) for (const priority of ["Low", "Medium", "High"]) {
      await field(page, "Status").selectOption(status); await field(page, "Priority").selectOption(priority);
      assert.equal(await page.locator("tbody tr").count(), fixture().tasks.filter(t => t.status === status && t.priority === priority).length);
    }
    await button(page, "Reset").click(); assert.equal(await page.locator("tbody tr").count(), 4);
    return "Проверены все 12 сочетаний AND, включая пустые выборки; после reset — 4 задачи.";
  });

  await check("T13", "Категории: создание, дубликат, формы, фильтр и reload", "Новая категория сохраняется; дубликат с другим регистром/пробелами запрещён", async page => {
    await nav(page, "Categories", "Expense categories"); await field(page, "Category name *").fill("  Maintenance  "); await button(page, "Add category").click();
    await page.getByRole("status").waitFor(); assert.equal((await read(page)).categories[2].name, "Maintenance");
    await field(page, "Category name *").fill(" maintenance "); await button(page, "Add category").click(); await appAlert(page).waitFor(); assert.equal((await read(page)).categories.length, 3);
    await page.reload(); await page.getByRole("heading", { name: "Expense categories", exact: true }).waitFor(); assert.equal((await read(page)).categories.length, 3);
    await nav(page, "Expenses"); await field(page, "Category").selectOption({ label: "Maintenance" }); await button(page, "Apply filters").click(); assert.equal(await page.locator("tbody tr").count(), 0);
    await button(page, "+ Add expense").click(); await field(page, "Category *").selectOption({ label: "Maintenance" }); assert.ok(await field(page, "Category *").inputValue()); await button(page, "Cancel").click();
    return "Maintenance сохранена после reload и доступна в форме/фильтре; maintenance с пробелами отклонена.";
  });

  await check("T14", "Удаление всех расходов и задач без повторной инициализации demo", "После удаления и reload пустые массивы, все карточки нулевые", async page => {
    await nav(page, "Expenses");
    while (await page.getByRole("button", { name: /^Delete expense / }).count()) { await page.getByRole("button", { name: /^Delete expense / }).first().click(); await button(page, "Delete record").click(); await page.getByRole("dialog").waitFor({ state: "hidden" }); }
    await nav(page, "Tasks");
    while (await page.getByRole("button", { name: /^Delete task / }).count()) { await page.getByRole("button", { name: /^Delete task / }).first().click(); await button(page, "Delete record").click(); await page.getByRole("dialog").waitFor({ state: "hidden" }); }
    await page.reload(); await button(page, "+ Add task").waitFor(); const data = await read(page); assert.deepEqual(data.expenses, []); assert.deepEqual(data.tasks, []); assert.equal(data.initialized, true);
    await total(page, "0.00 USD"); for (const id of ["pending-count", "overdue-count", "completed-count"]) assert.equal(await page.getByTestId(id).textContent(), "0");
    return "Все записи удалены через UI; reload не вернул demo; карточки 0.00/0/0/0.";
  });

  await check("T15", "Валидация форм расходов и задач", "Пустые поля, неверная сумма и пустая дата блокируются без записи", async page => {
    await nav(page, "Expenses"); await button(page, "+ Add expense").click();
    await field(page, "Description *").fill("   "); await field(page, "Date *").fill(""); await button(page, "Save expense").click();
    assert.equal(await page.locator("#description[aria-invalid=true]").count(), 1); assert.equal(await page.locator("#date[aria-invalid=true]").count(), 1);
    await field(page, "Description *").fill("Validation"); await field(page, "Date *").fill("2026-09-09");
    for (const amount of ["0", "-1", "1.234", "NaN", "Infinity", "1000000000"]) { await field(page, "Amount (USD) *").fill(amount); await button(page, "Save expense").click(); assert.equal(await page.locator("#amount[aria-invalid=true]").count(), 1); }
    assert.equal((await read(page)).expenses.length, 4); await button(page, "Cancel").click();
    await nav(page, "Tasks"); await button(page, "+ Add task").click(); await field(page, "Task *").fill("   "); await field(page, "Due date *").fill(""); await button(page, "Save task").click();
    assert.equal(await page.locator("#task[aria-invalid=true]").count(), 1); assert.equal(await page.locator("#dueDate[aria-invalid=true]").count(), 1); assert.equal((await read(page)).tasks.length, 4);
    await button(page, "Cancel").click();
    return "Проверены обязательные поля обеих форм и 6 недопустимых сумм; количество записей не изменилось.";
  });

  await check("T16", "Точная сумма 0.10 + 0.20 в браузере", "Weekly total = 0.30 USD", async page => {
    await nav(page, "Expenses");
    for (const amount of ["0.10", "0,20"]) { await button(page, "+ Add expense").click(); await fillExpense(page, { description: `Decimal ${amount}`, amount }); await saved(page, "expense"); }
    await total(page, "0.30 USD"); assert.deepEqual((await read(page)).expenses.map(e => e.amountMinor), [10, 20]);
    return "Два расхода сохранены как 10 и 20 центов, итог 0.30 USD.";
  }, { seed: empty() });

  await check("T17", "Повреждённые данные localStorage", "Понятная ошибка, исходное содержимое не перезаписывается", async page => {
    for (const raw of ["{broken json", JSON.stringify({ schemaVersion: 2 }), JSON.stringify({ ...fixture(), expenses: [{ ...fixture().expenses[0], categoryId: "missing" }] })]) {
      await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw }); await page.reload();
      await page.getByRole("heading", { name: "Unable to open your tracker", exact: true }).waitFor(); await appAlert(page).waitFor();
      assert.equal(await page.evaluate(k => localStorage.getItem(k), key), raw);
    }
    return "Невалидный JSON, неподдерживаемая схема и отсутствующая категория обработаны без перезаписи.";
  });

  await check("T18", "Отказ сохранения расхода и повторная попытка", "Нет ложного успеха; ввод и прежние данные сохранены; retry работает", async page => {
    const before = await read(page); await nav(page, "Expenses"); await button(page, "+ Add expense").click(); await fillExpense(page);
    await page.evaluate(() => { window.originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException("Simulated quota", "QuotaExceededError"); }; });
    await button(page, "Save expense").click(); await appAlert(page).waitFor(); assert.equal(await field(page, "Description *").inputValue(), "Created expense"); assert.deepEqual(await read(page), before);
    assert.equal(await page.getByRole("status").count(), 0);
    await page.evaluate(() => { Storage.prototype.setItem = window.originalSetItem; }); await saved(page, "expense"); assert.equal((await read(page)).expenses.length, 5);
    return "Симулирован QuotaExceededError; форма и исходные 4 записи сохранены, после восстановления сохранён пятый расход.";
  });

  await check("T19", "Отказ записи при смене статуса, удалении и добавлении категории", "Подтверждённое состояние не меняется, ошибки видны, ввод не теряется", async page => {
    const before = await read(page); await nav(page, "Tasks");
    await page.evaluate(() => { window.originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException("Simulated quota", "QuotaExceededError"); }; });
    await field(page, "Status for Pending yesterday").selectOption("Done"); await appAlert(page).waitFor(); assert.equal(await field(page, "Status for Pending yesterday").inputValue(), "Pending"); assert.deepEqual(await read(page), before);
    await button(page, "Delete task Pending yesterday").click(); await button(page, "Delete record").click(); await page.getByRole("dialog").getByRole("alert").waitFor(); assert.deepEqual(await read(page), before); await button(page, "Cancel").click();
    await nav(page, "Categories", "Expense categories"); await field(page, "Category name *").fill("Unwritten category"); await button(page, "Add category").click(); await appAlert(page).waitFor(); assert.equal(await field(page, "Category name *").inputValue(), "Unwritten category"); assert.deepEqual(await read(page), before);
    await page.evaluate(() => { Storage.prototype.setItem = window.originalSetItem; });
    return "Статус остался Pending, удаление не выполнено, категория не добавлена; показаны ошибки и сохранён ввод.";
  });

  await check("T20", "Отказ чтения хранилища", "Экран ошибки вместо неявного сброса или демоданных", async page => {
    await page.addInitScript(() => { Storage.prototype.getItem = function () { throw new DOMException("Storage access denied", "SecurityError"); }; });
    await page.reload(); await page.getByRole("heading", { name: "Unable to open your tracker", exact: true }).waitFor(); await appAlert(page).waitFor();
    return "При SecurityError отображён экран ошибки и кнопка Try again; необработанного падения нет.";
  });

  await check("T21", "Смена недели в открытом окне", "После полуночи воскресенье → понедельник сумма 20.20 → 88.00, задача становится overdue", async page => {
    assert.equal(await page.getByTestId("weekly-total").textContent(), "20.20 USD"); assert.equal(await page.getByTestId("overdue-count").textContent(), "0");
    await page.clock.fastForward(4000);
    await page.getByText("2026-09-14 — 2026-09-20", { exact: true }).waitFor();
    assert.equal(await page.getByTestId("weekly-total").textContent(), "88.00 USD"); assert.equal(await page.getByTestId("overdue-count").textContent(), "1");
    return "На открытой странице таймер обновил неделю, сумму и overdue без reload.";
  }, { time: "2026-09-13T23:59:58-04:00", seed: { ...empty(), expenses: [expense("Sunday", "2026-09-13", 2020), expense("Monday", "2026-09-14", 8800)], tasks: [task("Due Sunday", "2026-09-13", "New")] } });

  await check("T22", "Переход года и обновление при возвращении фокуса", "01 января остаётся в неделе 28.12–03.01; при фокусе 04.01 начинается новая неделя", async page => {
    assert.equal(await page.getByTestId("weekly-total").textContent(), "30.30 USD");
    await page.clock.fastForward(4000); await page.locator("time").filter({ hasText: "2027-01-01" }).waitFor();
    assert.equal(await page.getByTestId("weekly-total").textContent(), "30.30 USD"); assert.equal(await page.getByTestId("overdue-count").textContent(), "1");
    await page.clock.setFixedTime(new Date("2027-01-04T12:00:00-05:00")); await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.getByText("2027-01-04 — 2027-01-10", { exact: true }).waitFor(); assert.equal(await page.getByTestId("weekly-total").textContent(), "88.00 USD");
    return "Переход 2026→2027 не обрезал неделю; focus пересчитал дату и следующую неделю.";
  }, { time: "2026-12-31T23:59:58-05:00", seed: { ...empty(), expenses: [expense("December", "2026-12-28", 1010), expense("January", "2027-01-03", 2020), expense("Next week", "2027-01-04", 8800)], tasks: [task("Year end", "2026-12-31", "New")] } });

  await check("T23", "Desktop/mobile: страницы, формы и пустые состояния", "При 1440 и 390 px страницы не переполняются; формы и действия доступны", async page => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      for (const [name, title] of [["Dashboard", "Dashboard"], ["Expenses", "Expenses"], ["Tasks", "Tasks"], ["Categories", "Expense categories"]]) {
        await nav(page, name, title); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} overflow at ${width}`);
        await page.screenshot({ path: path.join(out, `${name.toLowerCase()}-${width}.png`), fullPage: true });
      }
      for (const [name, kind] of [["Expenses", "expense"], ["Tasks", "task"]]) {
        await nav(page, name); await button(page, `+ Add ${kind}`).click(); const box = await page.getByRole("dialog").boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width);
        await button(page, `Save ${kind}`).scrollIntoViewIfNeeded(); assert.ok(await button(page, `Save ${kind}`).isVisible()); await page.screenshot({ path: path.join(out, `${kind}-form-${width}.png`), fullPage: true }); await button(page, "Cancel").click();
      }
    }
    return "Проверены 4 страницы и 2 формы при 1440/390 px на пустых данных; сохранены 12 снимков, переполнения страницы нет.";
  }, { seed: empty() });

  await check("T24", "Клавиатура: focus, Tab, Escape и отмена удаления", "Focus удерживается в диалоге и возвращается к кнопке вызова; Cancel выбран по умолчанию", async page => {
    await nav(page, "Expenses"); await button(page, "+ Add expense").focus(); await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor();
    await page.waitForFunction(() => document.activeElement?.id === "description");
    for (let i = 0; i < 18; i++) { await page.keyboard.press("Tab"); assert.ok(await page.evaluate(() => document.querySelector("dialog").contains(document.activeElement))); }
    await page.keyboard.press("Escape"); await page.getByRole("dialog").waitFor({ state: "hidden" }); assert.equal(await page.evaluate(() => document.activeElement.textContent), "+ Add expense");
    await button(page, "Delete expense Monday expense").click(); assert.equal(await page.evaluate(() => document.activeElement.textContent), "Cancel"); await page.keyboard.press("Enter"); assert.equal((await read(page)).expenses.length, 4);
    return "Enter открывает форму, focus в Description, 18 Tab не выходят из диалога; Escape возвращает focus; Enter на Cancel не удаляет запись.";
  });
} finally {
  results.push({ id: "T25", scenario: "Отсутствие console/runtime errors", expected: "0 необработанных ошибок во всех сценариях", actual: `${consoleErrors.length} ошибок`, result: consoleErrors.length ? "FAIL" : "PASS", problem: consoleErrors.length ? JSON.stringify(consoleErrors) : "Нет" });
  await writeFile(path.join(out, "acceptance-results.json"), JSON.stringify({ completedAt: new Date().toISOString(), browser: `Microsoft Edge ${browser.version()} (headless)`, timezone: "America/New_York", fixedDefaultDate: "2026-09-09", origin, results, consoleErrors }, null, 2));
  console.log(`RESULT ${results.filter(r => r.result === "PASS").length}/${results.length} PASS`);
  await browser.close();
}
if (results.some(r => r.result === "FAIL")) process.exitCode = 1;

