"use client";
import { useState, type FormEvent } from "react";
import { Dialog, Field } from "./dialog";
import { useStore } from "./store-provider";
import { PRIORITIES, STATUSES, validDate, type Task, type Priority, type Status } from "@/lib/domain";

export function TaskForm({ task, onClose, onSaved }: { task?: Task; onClose: () => void; onSaved: () => void }) {
  const { today, commit } = useStore();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");
  const a11y = (name: string) => ({ "aria-invalid": Boolean(errors[name]), "aria-describedby": errors[name] ? `${name}-error` : undefined });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const get = (key: string) => String(form.get(key) ?? "").trim();
    const nextErrors: Record<string, string> = {};
    if (!get("task") || get("task").length > 200) nextErrors.task = "Enter a task of 1–200 characters.";
    if (!validDate(get("dueDate"))) nextErrors.dueDate = "Choose a valid due date.";
    if (get("owner").length > 100) nextErrors.owner = "Use no more than 100 characters.";
    if (get("note").length > 1000) nextErrors.note = "Use no more than 1000 characters.";
    if (!STATUSES.includes(get("status") as Status)) nextErrors.status = "Choose a status.";
    if (!PRIORITIES.includes(get("priority") as Priority)) nextErrors.priority = "Choose a priority.";
    setErrors(nextErrors); setSaveError("");
    if (Object.keys(nextErrors).length) return;
    const next: Task = { id: task?.id ?? crypto.randomUUID(), task: get("task"), owner: get("owner"), dueDate: get("dueDate"), status: get("status") as Status, priority: get("priority") as Priority, note: get("note") };
    try {
      commit(current => ({ ...current, tasks: task ? current.tasks.map(t => t.id === task.id ? next : t) : [...current.tasks, next] }));
      onSaved(); onClose();
    } catch (cause) { setSaveError((cause as Error).message); }
  }
  return <Dialog title={task ? "Edit task" : "Add task"} onClose={onClose}><form noValidate onSubmit={submit}>
    <p className="required-note">Fields marked * are required.</p><div className="form-grid">
      <Field name="task" label="Task *" error={errors.task} full><input autoFocus id="task" name="task" required maxLength={200} defaultValue={task?.task ?? ""} {...a11y("task")} /></Field>
      <Field name="owner" label="Owner" error={errors.owner}><input id="owner" name="owner" maxLength={100} placeholder="Unassigned" defaultValue={task?.owner ?? ""} {...a11y("owner")} /></Field>
      <Field name="dueDate" label="Due date *" error={errors.dueDate}><input id="dueDate" name="dueDate" type="date" min="0001-01-01" max="9999-12-31" required defaultValue={task?.dueDate ?? today} {...a11y("dueDate")} /></Field>
      <Field name="status" label="Status *" error={errors.status}><select id="status" name="status" aria-label="Status *" defaultValue={task?.status ?? "New"} {...a11y("status")}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></Field>
      <Field name="priority" label="Priority *" error={errors.priority}><select id="priority" name="priority" aria-label="Priority *" defaultValue={task?.priority ?? "Medium"} {...a11y("priority")}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></Field>
      <Field name="note" label="Note" error={errors.note} full><textarea id="note" name="note" maxLength={1000} defaultValue={task?.note ?? ""} {...a11y("note")} /></Field>
    </div>{saveError && <p className="error" role="alert">{saveError}</p>}<div className="dialog-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" type="submit">Save task</button></div>
  </form></Dialog>;
}
