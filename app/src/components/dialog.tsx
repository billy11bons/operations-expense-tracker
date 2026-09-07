"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    requestAnimationFrame(() => dialog?.querySelector<HTMLElement>("[autofocus], input, textarea, select")?.focus());
    return () => {
      dialog?.close();
      requestAnimationFrame(() => trigger?.focus());
    };
  }, []);
  function trapFocus(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab" || !ref.current) return;
    const focusable = Array.from(ref.current.querySelectorAll<HTMLElement>("button, input, select, textarea, [href], [tabindex]:not([tabindex='-1'])")).filter(el => !el.hasAttribute("disabled"));
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return <dialog ref={ref} aria-labelledby="dialog-title" onCancel={onClose} onKeyDown={trapFocus}>
    <div className="dialog-heading"><h2 id="dialog-title">{title}</h2><button type="button" onClick={onClose} aria-label="Close dialog">×</button></div>
    <div className="dialog-body">{children}</div>
  </dialog>;
}
export function DeleteDialog({ name, onClose, onDelete }: { name: string; onClose: () => void; onDelete: () => void }) {
  const [error, setError] = useState("");
  return <Dialog title="Delete record?" onClose={onClose}><p>Delete <strong>{name}</strong>? This cannot be undone.</p>{error && <p className="error" role="alert">{error}</p>}<div className="dialog-actions"><button autoFocus onClick={onClose}>Cancel</button><button className="danger" onClick={() => { try { onDelete(); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete this record."); } }}>Delete record</button></div></Dialog>;
}
export function Field({ name, label, error, children, full = false }: { name: string; label: string; error?: string; children: ReactNode; full?: boolean }) {
  return <label htmlFor={name} className={full ? "full" : undefined}>{label}{children}{error && <span className="field-error" id={`${name}-error`}>{error}</span>}</label>;
}
