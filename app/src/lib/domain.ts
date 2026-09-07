export const STATUSES = ["New", "In Progress", "Pending", "Done"] as const;
export const PRIORITIES = ["Low", "Medium", "High"] as const;
export const PAYMENT_METHODS = ["Cash", "Card", "Bank transfer", "Other"] as const;
export const STORAGE_KEY = "case01.operationsExpenseTracker.v1";
export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type Category = { id: string; name: string };
export type Expense = {
  id: string; date: string; categoryId: string; description: string;
  amountMinor: number; paymentMethod: PaymentMethod; note: string;
};
export type Task = {
  id: string; task: string; owner: string; dueDate: string;
  status: Status; priority: Priority; note: string;
};
export type Store = {
  schemaVersion: 1; initialized: true;
  expenses: Expense[]; tasks: Task[]; categories: Category[];
};

export function localDate(date = new Date()): string {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function calendarDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(2000, 0, 1, 12);
  result.setFullYear(year, month - 1, day);
  return result;
}
export function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && value >= "0001-01-01" && localDate(calendarDate(value)) === value;
}
export function addDays(value: string, days: number): string {
  const date = calendarDate(value);
  date.setDate(date.getDate() + days);
  return localDate(date);
}
export function weekRange(today: string): { start: string; end: string; next: string } {
  const weekday = calendarDate(today).getDay();
  const start = addDays(today, -((weekday + 6) % 7));
  return { start, end: addDays(start, 6), next: addDays(start, 7) };
}
export function parseAmount(value: string): number {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Enter an amount from 0.01 to 999999999.99 with up to 2 decimal places.");
  }
  const [whole, fraction = ""] = normalized.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (amount <= 0 || amount > 99999999999) throw new Error("Amount must be greater than zero.");
  return amount;
}
export function money(amountMinor: number): string {
  return `${(amountMinor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
}
export function overdue(task: Task, today: string): boolean {
  return task.status !== "Done" && task.dueDate < today;
}
export function summarize(data: Store, today: string) {
  const week = weekRange(today);
  const weeklyTotal = data.expenses.filter(e => e.date >= week.start && e.date < week.next)
    .reduce((sum, e) => sum + e.amountMinor, 0);
  if (!Number.isSafeInteger(weeklyTotal)) throw new Error("Expense total exceeds the supported range.");
  return {
    week, weeklyTotal,
    pending: data.tasks.filter(t => t.status === "Pending").length,
    overdue: data.tasks.filter(t => overdue(t, today)).length,
    completed: data.tasks.filter(t => t.status === "Done").length,
  };
}
export type ExpenseFilter = { from: string; to: string; categoryId: string };
export function filterExpenses(expenses: Expense[], filter: ExpenseFilter): Expense[] {
  return expenses.filter(e => (!filter.from || e.date >= filter.from)
    && (!filter.to || e.date <= filter.to) && (!filter.categoryId || e.categoryId === filter.categoryId))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
export function filterTasks(tasks: Task[], status = "", priority = ""): Task[] {
  return tasks.filter(t => (!status || t.status === status) && (!priority || t.priority === priority))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
}
function text(value: unknown, max: number, required = false): value is string {
  return typeof value === "string" && value.length <= max && (!required || value.trim().length > 0);
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function validateStore(value: unknown): asserts value is Store {
  if (!record(value) || value.schemaVersion !== 1 || value.initialized !== true
    || !Array.isArray(value.categories) || !Array.isArray(value.expenses) || !Array.isArray(value.tasks)) {
    throw new Error("Saved data has an unsupported format. It has not been overwritten.");
  }
  const ids = new Set<string>();
  const names = new Set<string>();
  const categoryIds = new Set<string>();
  const identify = (item: Record<string, unknown>) => {
    if (!text(item.id, 200, true) || ids.has(item.id)) throw new Error("Saved data contains an invalid or duplicate ID.");
    ids.add(item.id);
  };
  for (const c of value.categories) {
    if (!record(c) || !text(c.name, 50, true) || names.has(c.name.trim().toLowerCase())) {
      throw new Error("Category names must be unique and contain 1–50 characters.");
    }
    identify(c); categoryIds.add(c.id as string); names.add(c.name.trim().toLowerCase());
  }
  let total = 0;
  for (const e of value.expenses) {
    if (!record(e) || !validDate(e.date) || !text(e.description, 200, true)
      || !text(e.note, 1000) || !categoryIds.has(e.categoryId as string)
      || !PAYMENT_METHODS.includes(e.paymentMethod as PaymentMethod)
      || typeof e.amountMinor !== "number" || !Number.isSafeInteger(e.amountMinor)
      || e.amountMinor <= 0 || e.amountMinor > 99999999999) throw new Error("An expense contains invalid fields.");
    identify(e); total += e.amountMinor;
    if (!Number.isSafeInteger(total)) throw new Error("Expense total exceeds the supported range.");
  }
  for (const t of value.tasks) {
    if (!record(t) || !text(t.task, 200, true) || !text(t.owner, 100)
      || !text(t.note, 1000) || !validDate(t.dueDate)
      || !STATUSES.includes(t.status as Status) || !PRIORITIES.includes(t.priority as Priority)) {
      throw new Error("A task contains invalid fields.");
    }
    identify(t);
  }
}
export function createDemo(today: string): Store {
  const start = weekRange(today).start;
  return {
    schemaVersion: 1, initialized: true,
    categories: ["Supplies", "Transport", "Utilities", "Other"].map((name, i) => ({ id: `category-${i}`, name })),
    expenses: [
      { id: "expense-1", date: start, categoryId: "category-0", description: "Office supplies", amountMinor: 8450, paymentMethod: "Card", note: "Printer paper and stationery" },
      { id: "expense-2", date: today, categoryId: "category-1", description: "Client delivery", amountMinor: 2800, paymentMethod: "Cash", note: "" },
      { id: "expense-3", date: today, categoryId: "category-2", description: "Internet subscription", amountMinor: 6500, paymentMethod: "Bank transfer", note: "Monthly service" },
      { id: "expense-4", date: addDays(start, -2), categoryId: "category-3", description: "Team lunch", amountMinor: 4200, paymentMethod: "Card", note: "Previous week" },
    ],
    tasks: [
      { id: "task-1", task: "Confirm supplier delivery", owner: "Alex", dueDate: addDays(today, -1), status: "Pending", priority: "High", note: "Waiting for the supplier's reply" },
      { id: "task-2", task: "Review weekly expenses", owner: "Sam", dueDate: today, status: "In Progress", priority: "Medium", note: "" },
      { id: "task-3", task: "Schedule equipment service", owner: "", dueDate: addDays(today, 2), status: "New", priority: "Low", note: "" },
      { id: "task-4", task: "Approve purchase list", owner: "Alex", dueDate: addDays(today, 1), status: "Pending", priority: "Medium", note: "" },
      { id: "task-5", task: "File last week's receipts", owner: "Sam", dueDate: addDays(today, -2), status: "Done", priority: "Low", note: "" },
    ],
  };
}
