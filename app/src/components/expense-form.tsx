"use client";
import { useState, type FormEvent } from "react";
import { Dialog, Field } from "./dialog";
import { useStore } from "./store-provider";
import { parseAmount, PAYMENT_METHODS, validDate, type Expense, type PaymentMethod } from "@/lib/domain";

export function ExpenseForm({ expense, onClose, onSaved }: { expense?: Expense; onClose: () => void; onSaved: () => void }) {
  const { data, today, commit } = useStore();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");
  const a11y = (name: string) => ({ "aria-invalid": Boolean(errors[name]), "aria-describedby": errors[name] ? `${name}-error` : undefined });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const get = (key: string) => String(form.get(key) ?? "").trim();
    const nextErrors: Record<string, string> = {};
    let amountMinor = 0;
    try { amountMinor = parseAmount(get("amount")); } catch (cause) { nextErrors.amount = (cause as Error).message; }
    if (!validDate(get("date"))) nextErrors.date = "Choose a valid date.";
    if (!get("description") || get("description").length > 200) nextErrors.description = "Enter a description of 1–200 characters.";
    if (!data.categories.some(c => c.id === get("categoryId"))) nextErrors.categoryId = "Choose a category.";
    if (!PAYMENT_METHODS.includes(get("paymentMethod") as PaymentMethod)) nextErrors.paymentMethod = "Choose a payment method.";
    if (get("note").length > 1000) nextErrors.note = "Use no more than 1000 characters.";
    setErrors(nextErrors); setSaveError("");
    if (Object.keys(nextErrors).length) return;
    const next: Expense = { id: expense?.id ?? crypto.randomUUID(), date: get("date"), description: get("description"), categoryId: get("categoryId"), amountMinor, paymentMethod: get("paymentMethod") as PaymentMethod, note: get("note") };
    try {
      commit(current => ({ ...current, expenses: expense ? current.expenses.map(e => e.id === expense.id ? next : e) : [...current.expenses, next] }));
      onSaved(); onClose();
    } catch (cause) { setSaveError((cause as Error).message); }
  }
  return <Dialog title={expense ? "Edit expense" : "Add expense"} onClose={onClose}><form noValidate onSubmit={submit}>
    <p className="required-note">Fields marked * are required. All amounts are in USD.</p>
    <div className="form-grid">
      <Field name="description" label="Description *" error={errors.description} full><input autoFocus id="description" name="description" maxLength={200} required defaultValue={expense?.description ?? ""} {...a11y("description")} /></Field>
      <Field name="date" label="Date *" error={errors.date}><input id="date" name="date" type="date" min="0001-01-01" max="9999-12-31" required defaultValue={expense?.date ?? today} {...a11y("date")} /></Field>
      <Field name="amount" label="Amount (USD) *" error={errors.amount}><input id="amount" name="amount" inputMode="decimal" placeholder="0.00" required defaultValue={expense ? (expense.amountMinor / 100).toFixed(2) : ""} {...a11y("amount")} /></Field>
      <Field name="categoryId" label="Category *" error={errors.categoryId}><select id="categoryId" name="categoryId" aria-label="Category *" required defaultValue={expense?.categoryId ?? data.categories[0]?.id ?? ""} {...a11y("categoryId")}><option value="" disabled>Select category</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field name="paymentMethod" label="Payment method *" error={errors.paymentMethod}><select id="paymentMethod" name="paymentMethod" aria-label="Payment method *" defaultValue={expense?.paymentMethod ?? "Card"} {...a11y("paymentMethod")}>{PAYMENT_METHODS.map(p => <option key={p}>{p}</option>)}</select></Field>
      <Field name="note" label="Note" error={errors.note} full><textarea id="note" name="note" maxLength={1000} defaultValue={expense?.note ?? ""} {...a11y("note")} /></Field>
    </div>{saveError && <p role="alert" className="error">{saveError}</p>}<div className="dialog-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" type="submit">Save expense</button></div>
  </form></Dialog>;
}
