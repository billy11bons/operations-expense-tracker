"use client";
import { useState } from "react";
import { useStore } from "@/components/store-provider";
import { TaskForm } from "@/components/task-form";
import { DeleteDialog } from "@/components/dialog";
import { filterTasks, overdue, PRIORITIES, STATUSES, type Status, type Task } from "@/lib/domain";

export default function Tasks() {
  const { data, today, commit } = useStore();
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const rows = filterTasks(data.tasks, status, priority);
  function changeStatus(id: string, value: Status) {
    setError(""); setNotice("");
    try { commit(current => ({ ...current, tasks: current.tasks.map(t => t.id === id ? { ...t, status: value } : t) })); setNotice("Task status saved."); }
    catch (cause) { setError((cause as Error).message); }
  }
  return <>
    <div className="page-heading"><div><p className="eyebrow">DAILY OPERATIONS</p><h1>Tasks</h1><p>Track responsibilities, deadlines and next steps.</p></div><button className="primary" onClick={() => { setNotice(""); setEditing("new"); }}>+ Add task</button></div>
    {notice && <p className="notice" role="status">{notice}</p>}{error && <p role="alert" className="error">{error}</p>}
    <section className="panel" aria-label="Task records"><div className="filters">
      <label htmlFor="filter-status">Status<select id="filter-status" aria-label="Status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></label>
      <label htmlFor="filter-priority">Priority<select id="filter-priority" aria-label="Priority" value={priority} onChange={e => setPriority(e.target.value)}><option value="">All priorities</option>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></label>
      <button onClick={() => { setStatus(""); setPriority(""); }}>Reset</button><span className="list-count">{rows.length} of {data.tasks.length} tasks</span>
    </div>{rows.length ? <div className="table-wrap"><table><thead><tr><th>Task</th><th>Owner</th><th>Due date</th><th>Status</th><th>Priority</th><th>Actions</th></tr></thead><tbody>{rows.map(t => <tr key={t.id}>
      <td className="record-title" data-label="Task"><strong>{t.task}</strong>{t.note && <span className="secondary">{t.note}</span>}<div className="badges">{t.status === "Pending" && <span className="badge pending">Pending</span>}{overdue(t, today) && <span className="badge overdue">Overdue</span>}{t.status === "Done" && <span className="badge done">Done</span>}</div></td>
      <td data-label="Owner">{t.owner || "Unassigned"}</td><td data-label="Due date" className={overdue(t, today) ? "danger-text" : ""}>{t.dueDate}</td>
      <td data-label="Status"><select className="inline-status" aria-label={`Status for ${t.task}`} value={t.status} onChange={e => changeStatus(t.id, e.target.value as Status)}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></td><td data-label="Priority">{t.priority}</td>
      <td><div className="row-actions"><button onClick={() => { setNotice(""); setEditing(t); }} aria-label={`Edit task ${t.task}`}>Edit</button><button className="danger" onClick={() => { setNotice(""); setDeleting(t); }} aria-label={`Delete task ${t.task}`}>Delete</button></div></td>
    </tr>)}</tbody></table></div> : <div className="empty">{data.tasks.length ? "No tasks match these filters. Try another status or priority." : "No tasks yet. Add your first task."}</div>}</section>
    <p className="footnote">A task is overdue when its due date is before today and its status is not Done.</p>
    {editing && <TaskForm task={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setError(""); setNotice("Task saved in this browser."); }} />}
    {deleting && <DeleteDialog name={deleting.task} onClose={() => setDeleting(null)} onDelete={() => { commit(current => ({ ...current, tasks: current.tasks.filter(t => t.id !== deleting.id) })); setNotice("Task deleted."); }} />}
  </>;
}
