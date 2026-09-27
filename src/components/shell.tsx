"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Bell, FolderKanban, Inbox, LayoutDashboard, LifeBuoy, LogOut, Menu, Settings, Sparkles, UserRound, Users, Wallet, X,
} from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Avatar, Logo, cx } from "./ui";

const icons = { LayoutDashboard, FolderKanban, LifeBuoy, Sparkles, Bell, UserRound, Users, Inbox, Wallet, Settings };
export type NavItem = { href: string; label: string; icon: keyof typeof icons; badge?: number };

function isActive(path: string, href: string) {
  if (href === "/admin" || href === "/painel") return path === href;
  return path === href || path.startsWith(href + "/");
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <ul className="grid gap-1">
      {items.map((item) => {
        const Icon = icons[item.icon];
        const active = isActive(path, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cx(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active ? "bg-blue/12 text-text ring-1 ring-inset ring-blue/30" : "text-soft hover:bg-surface-2 hover:text-text",
              )}
            >
              <Icon className={cx("size-[18px]", active ? "text-blue-2" : "text-mute group-hover:text-soft")} aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              {!!item.badge && (
                <span className="rounded-full bg-amber/15 px-2 font-mono text-[10.5px] text-amber tabular">{item.badge}</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function Shell({
  nav, name, company, admin, bell, children,
}: { nav: NavItem[]; name: string; company: string; admin: boolean; bell: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const account = (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/50 p-3">
      <Avatar name={name} admin={admin} />
      <Link href="/conta" onClick={() => setOpen(false)} className="min-w-0 flex-1 hover:text-blue-2">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="truncate text-xs text-mute">{admin ? "Equipe Elite Systems" : company || "Cliente"}</p>
      </Link>
      <form action={signOut}>
        <button className="grid size-9 place-items-center rounded-lg text-mute hover:bg-surface-2 hover:text-red" title="Sair" aria-label="Sair">
          <LogOut className="size-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-surface/60 p-4 lg:flex">
        <Link href={admin ? "/admin" : "/painel"} className="px-2 pt-2"><Logo /></Link>
        {admin && <p className="eyebrow -mt-3 px-2 text-green">Painel da equipe</p>}
        <nav aria-label="Principal" className="flex-1 overflow-y-auto"><NavList items={nav} /></nav>
        {account}
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur-xl sm:px-6 lg:px-10">
          <button className="grid size-10 place-items-center rounded-xl border border-line lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <Link href={admin ? "/admin" : "/painel"} className="lg:hidden"><Logo compact /></Link>
          <div className="hidden lg:block" />
          {bell}
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} aria-label="Fechar menu" />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-xs flex-col gap-6 border-r border-line bg-surface p-4 animate-rise">
            <div className="flex items-center justify-between px-2 pt-2">
              <Logo />
              <button className="grid size-9 place-items-center rounded-lg text-mute" onClick={() => setOpen(false)} aria-label="Fechar menu">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Principal" className="flex-1 overflow-y-auto"><NavList items={nav} onNavigate={() => setOpen(false)} /></nav>
            {account}
          </div>
        </div>
      )}
    </div>
  );
}
