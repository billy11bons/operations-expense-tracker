"use client";
import { useState, type FormEvent } from "react";
import { useStore } from "@/components/store-provider";

export default function Categories() {
  const { data, commit } = useStore();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    const clean = name.trim();
    if (!clean || clean.length > 50) { setError("Enter a category name of 1–50 characters."); return; }
    if (data.categories.some(c => c.name.trim().toLowerCase() === clean.toLowerCase())) { setError("This category already exists."); return; }
    try { commit(current => ({ ...current, categories: [...current.categories, { id: crypto.randomUUID(), name: clean }] })); setName(""); setNotice(`Category “${clean}” added.`); }
    catch (cause) { setError((cause as Error).message); }
  }
  return <>
    <div className="page-heading"><div><p className="eyebrow">SETTINGS / CATEGORIES</p><h1>Expense categories</h1><p>Organize spending with categories that fit your business.</p></div></div>
    {notice && <p className="notice" role="status">{notice}</p>}
    <div className="categories-grid"><section className="panel"><div className="panel-heading"><h2>Your categories</h2><span className="badge">{data.categories.length}</span></div>{data.categories.length ? <ul className="record-list">{data.categories.map(c => <li key={c.id}><strong>{c.name}</strong><span className="list-count">{data.expenses.filter(e => e.categoryId === c.id).length} expenses</span></li>)}</ul> : <div className="empty">No categories yet. Add one to record an expense.</div>}</section>
      <section className="panel"><div className="panel-heading"><h2>Add a category</h2></div><form className="category-form" noValidate onSubmit={submit}><label htmlFor="category-name">Category name *<input id="category-name" required maxLength={50} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Maintenance" aria-invalid={Boolean(error)} aria-describedby={error ? "category-error" : undefined} /></label>{error && <p id="category-error" role="alert" className="error">{error}</p>}<button type="submit" className="primary">Add category</button></form></section>
    </div><p className="footnote">New categories are available in expense forms and filters. Existing categories are retained to keep past records consistent.</p>
  </>;
}
