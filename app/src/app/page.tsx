"use client";
import Link from "next/link";
import { useStore } from "@/components/store-provider";
import { filterExpenses, filterTasks, money, overdue, summarize } from "@/lib/domain";

export default function Dashboard() {
  const { data, today } = useStore();
  const summary = summarize(data, today);
  const attention = filterTasks(data.tasks).filter(t => t.status === "Pending" || overdue(t, today));
  const recent = filterExpenses(data.expenses, { from: "", to: "", categoryId: "" }).slice(0, 5);
  return <>
    <div className="page-heading"><div><p className="eyebrow">OVERVIEW</p><h1>Dashboard</h1><p>Your expenses and daily operations at a glance.</p></div><Link className="button primary" href="/expenses">View expenses <span aria-hidden="true">↗</span></Link></div>
    <div className="week-caption">Current week <strong>{summary.week.start} — {summary.week.end}</strong><span>Monday to Sunday · USD</span></div>
    <section className="metrics" aria-label="Overview totals">
      <article className="metric featured"><span>This week’s expenses</span><strong data-testid="weekly-total">{money(summary.weeklyTotal)}</strong><small>All expenses dated within this week</small></article>
      <article className="metric"><span>Pending tasks</span><strong data-testid="pending-count">{summary.pending}</strong><small>Waiting for a next step</small></article>
      <article className="metric"><span>Overdue tasks</span><strong className="danger-text" data-testid="overdue-count">{summary.overdue}</strong><small>Past due and not completed</small></article>
      <article className="metric"><span>Completed tasks</span><strong data-testid="completed-count">{summary.completed}</strong><small>Done · all time</small></article>
    </section>
    <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><h2>Needs attention</h2><Link href="/tasks">View tasks →</Link></div>
      {attention.length ? <ul className="record-list">{attention.map(t => <li key={t.id}><div><strong>{t.task}</strong><p>{t.owner || "Unassigned"} · Due {t.dueDate}</p></div><div className="badges">{t.status === "Pending" && <span className="badge pending">Pending</span>}{overdue(t, today) && <span className="badge overdue">Overdue</span>}</div></li>)}</ul> : <div className="empty">No pending or overdue tasks.</div>}
    </section><section className="panel"><div className="panel-heading"><h2>Recent expenses</h2><Link href="/expenses">View all →</Link></div>
      {recent.length ? <ul className="record-list">{recent.map(e => <li key={e.id}><div><strong>{e.description}</strong><p>{data.categories.find(c => c.id === e.categoryId)?.name} · {e.date}</p></div><strong className="amount">{money(e.amountMinor)}</strong></li>)}</ul> : <div className="empty">No expenses yet. Add your first expense to get started.</div>}
    </section></div>
    <p className="footnote">Pending and overdue can include the same task. Completed tasks are never overdue.</p>
  </>;
}
