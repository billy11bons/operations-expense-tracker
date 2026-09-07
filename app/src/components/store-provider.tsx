"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createDemo, localDate, STORAGE_KEY, validateStore, type Store } from "@/lib/domain";

type ContextValue = {
  data: Store; today: string;
  commit: (update: (current: Store) => Store) => void;
};
const Context = createContext<ContextValue | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Store | null>(null);
  const current = useRef<Store | null>(null);
  const [today, setToday] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refreshDay = () => {
      setToday(localDate());
      clearTimeout(timer);
      const next = new Date();
      next.setHours(24, 0, 0, 25);
      timer = setTimeout(refreshDay, Math.max(25, next.getTime() - Date.now()));
    };
    refreshDay();
    window.addEventListener("focus", refreshDay);
    document.addEventListener("visibilitychange", refreshDay);
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const initial: unknown = saved === null ? createDemo(localDate()) : JSON.parse(saved);
      validateStore(initial);
      if (saved === null) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      current.current = initial;
      setData(initial);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Browser storage is unavailable.");
    }
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refreshDay);
      document.removeEventListener("visibilitychange", refreshDay);
    };
  }, []);
  function commit(update: (value: Store) => Store) {
    if (!current.current) throw new Error("Your data is not available yet.");
    const next = update(current.current);
    validateStore(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      throw new Error("Could not save to this browser. Your changes have not been saved. Keep this form open and try again.");
    }
    current.current = next;
    setData(next);
  }
  if (error) return <main className="storage-error"><h1>Unable to open your tracker</h1><p role="alert">{error}</p><p>Existing browser data has not been replaced. Check browser storage access or restore a valid saved copy before continuing.</p><button onClick={() => window.location.reload()}>Try again</button></main>;
  if (!data || !today) return <main className="storage-error" aria-busy="true"><p>Opening your tracker…</p></main>;
  return <Context.Provider value={{ data, today, commit }}>{children}</Context.Provider>;
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error("Tracker must be inside StoreProvider.");
  return value;
}
