import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemo, parseAmount, summarize, validateStore, weekRange, filterExpenses, filterTasks, validDate, type Expense } from "../src/lib/domain";

test("decimal amounts are exact and invalid input is rejected", () => {
  assert.equal(parseAmount("0.10") + parseAmount("0,20"), 30);
  assert.equal(parseAmount("999999999.99"), 99999999999);
  for (const value of ["0", "-1", "1.234", "NaN", "Infinity", "1,000.50", "1000000000"]) assert.throws(() => parseAmount(value));
});
test("calendar weeks include Sunday and cross year boundaries", () => {
  assert.deepEqual(weekRange("2026-09-13"), { start: "2026-09-07", end: "2026-09-13", next: "2026-09-14" });
  assert.deepEqual(weekRange("2027-01-01"), { start: "2026-12-28", end: "2027-01-03", next: "2027-01-04" });
  assert.equal(validDate("2026-02-29"), false); assert.equal(validDate("2028-02-29"), true);
});
test("weekly totals update across edits, deletion and date moves", () => {
  const data = createDemo("2026-09-09");
  const template = data.expenses[0];
  data.expenses = [["2026-09-06", 9900], ["2026-09-07", 1010], ["2026-09-13", 2020], ["2026-09-14", 8800]].map(([date, amountMinor], i) => ({ ...template, id: `e-${i}`, date, amountMinor } as Expense));
  assert.equal(summarize(data, "2026-09-09").weeklyTotal, 3030);
  data.expenses[1].amountMinor = 1210;
  assert.equal(summarize(data, "2026-09-09").weeklyTotal, 3230);
  data.expenses.splice(2, 1);
  assert.equal(summarize(data, "2026-09-09").weeklyTotal, 1210);
  data.expenses[1].date = "2026-09-14";
  assert.equal(summarize(data, "2026-09-09").weeklyTotal, 0);
});
test("Pending and overdue overlap, Done is excluded, today is not overdue", () => {
  const data = createDemo("2026-09-09");
  const template = data.tasks[0];
  data.tasks = [
    { ...template, id: "a", status: "Pending", dueDate: "2026-09-08" },
    { ...template, id: "b", status: "Pending", dueDate: "2026-09-09" },
    { ...template, id: "c", status: "New", dueDate: "2026-09-08" },
    { ...template, id: "d", status: "Done", dueDate: "2026-09-08" },
  ];
  const counts = () => { const s = summarize(data, "2026-09-09"); return [s.pending, s.overdue, s.completed]; };
  assert.deepEqual(counts(), [2, 2, 1]);
  data.tasks[0].status = "Done"; assert.deepEqual(counts(), [1, 1, 2]);
  data.tasks[0].status = "Pending"; assert.deepEqual(counts(), [2, 2, 1]);
});
test("filters use inclusive dates and AND without mutating source records", () => {
  const data = createDemo("2026-09-09");
  const before = JSON.stringify(data);
  assert.deepEqual(filterExpenses(data.expenses, { from: "2026-09-07", to: "2026-09-07", categoryId: "category-0" }).map(e => e.id), ["expense-1"]);
  assert.deepEqual(filterTasks(data.tasks, "Pending", "High").map(t => t.id), ["task-1"]);
  assert.equal(JSON.stringify(data), before);
});
test("persistence validation accepts empty records and rejects corrupt references", () => {
  const data = createDemo("2026-09-09");
  validateStore(JSON.parse(JSON.stringify(data)));
  validateStore({ ...data, expenses: [], tasks: [] });
  assert.throws(() => validateStore({ schemaVersion: 2 }));
  assert.throws(() => validateStore({ ...data, expenses: [{ ...data.expenses[0], categoryId: "missing" }] }));
  assert.throws(() => validateStore({ ...data, categories: [...data.categories, { id: "new", name: " supplies " }] }));
  assert.throws(() => validateStore({ ...data, tasks: [{ ...data.tasks[0], dueDate: "2026-02-30" }] }));
});
