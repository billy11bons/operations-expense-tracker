"use client";
import { useState, type FormEvent } from "react";
import { useStore } from "@/components/store-provider";
import { ExpenseForm } from "@/components/expense-form";
import { DeleteDialog } from "@/components/dialog";
import { filterExpenses, money, validDate, type Expense, type ExpenseFilter } from "@/lib/domain";

const emptyFilter: ExpenseFilter = { from: "", to: "", categoryId: "" };
export default function Expenses() {
  const { data, commit } = useStore();
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [draft, setDraft] = useState(emptyFilter);
  const [filter, setFilter] = useState(emptyFilter);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const rows = filterExpenses(data.expenses, filter);
  function apply(event: FormEvent) {
    event.preventDefault();
    if ((draft.from && !validDate(draft.from)) || (draft.to && !validDate(draft.to))) { setError("Choose valid filter dates."); return; }
    if (draft.from && draft.to && draft.from > draft.to) { setError("From date must be on or before To date. Previous filters are still applied."); return; }
    setError(""); setFilter(draft);
  }
  return <>
    <div className="page-heading"><div><p className="eyebrow">DAILY EXPENSES</p><h1>Expenses</h1><p>Keep every business expense in one place.</p></div><button className="primary" onClick={() => { setNotice(""); setEditing("new"); }}>+ Add expense</button></div>
    {notice && <p className="notice" role="status">{notice}</p>}
    <section className="panel" aria-label="Expense records">
      <form className="filters" onSubmit={apply} noValidate>
        <label htmlFor="from">From<input id="from" type="date" min="0001-01-01" max="9999-12-31" value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value })} /></label>
        <label htmlFor="to">To<input id="to" type="date" min="0001-01-01" max="9999-12-31" value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })} /></label>
        <label htmlFor="filter-category">Category<select id="filter-category" aria-label="Category" value={draft.categoryId} onChange={e => setDraft({ ...draft, categoryId: e.target.value })}><option value="">All categories</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <button type="submit">Apply filters</button><button type="button" onClick={() => { setDraft(emptyFilter); setFilter(emptyFilter); setError(""); }}>Reset</button><span className="list-count">{rows.length} of {data.expenses.length} expenses</span>
        {error && <p role="alert" className="error full">{error}</p>}
      </form>
      {rows.length ? <div className="table-wrap"><table><thead><tr><th>Description</th><th>Date</th><th>Category</th><th>Amount</th><th>Payment</th><th>Actions</th></tr></thead><tbody>{rows.map(e => <tr key={e.id}>
        <td className="record-title" data-label="Description"><strong>{e.description}</strong>{e.note && <span className="secondary">{e.note}</span>}</td>
        <td data-label="Date">{e.date}</td><td data-label="Category">{data.categories.find(c => c.id === e.categoryId)?.name}</td><td data-label="Amount" className="amount">{money(e.amountMinor)}</td><td data-label="Payment">{e.paymentMethod}</td>
        <td><div className="row-actions"><button onClick={() => { setNotice(""); setEditing(e); }} aria-label={`Edit expense ${e.description}`}>Edit</button><button className="danger" onClick={() => { setNotice(""); setDeleting(e); }} aria-label={`Delete expense ${e.description}`}>Delete</button></div></td>
      </tr>)}</tbody></table></div> : <div className="empty">{data.expenses.length ? "No expenses match these filters. Try a different date or category." : "No expenses yet. Add your first expense."}</div>}
    </section><p className="footnote">Amounts in USD. Dashboard totals always include all expenses for the current week.</p>
    {editing && <ExpenseForm expense={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => setNotice("Expense saved in this browser.")} />}
    {deleting && <DeleteDialog name={deleting.description} onClose={() => setDeleting(null)} onDelete={() => { commit(current => ({ ...current, expenses: current.expenses.filter(e => e.id !== deleting.id) })); setNotice("Expense deleted."); }} />}
  </>;
}
