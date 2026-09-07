"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { StoreProvider, useStore } from "./store-provider";

const links = [["/", "Dashboard", "◫"], ["/expenses", "Expenses", "↗"], ["/tasks", "Tasks", "✓"], ["/settings", "Categories", "≡"]];
function Frame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { today } = useStore();
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/"><span className="brand-mark">O</span><span>Operations<span className="brand-sub">Expense & task tracker</span></span></Link>
      <nav aria-label="Main navigation">{links.map(([href, label, symbol]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}><span aria-hidden="true">{symbol}</span>{label}</Link>)}</nav>
      <div className="sidebar-foot"><span className="local-dot"/>Local workspace<p>Saved in this browser</p></div>
    </aside>
    <div className="workspace"><header className="topbar"><span>Small business workspace</span><time dateTime={today}>{today}</time></header><main id="main-content">{children}</main></div>
  </div>;
}
export function Shell({ children }: { children: ReactNode }) {
  return <><a className="skip-link" href="#main-content">Skip to content</a><StoreProvider><Frame>{children}</Frame></StoreProvider></>;
}
