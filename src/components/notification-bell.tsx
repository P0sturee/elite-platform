"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { relative } from "@/lib/format";
import type { Notification } from "@/lib/types";
import { cx } from "./ui";

export function NotificationBell({ userId, initial }: { userId: string; initial: Notification[] }) {
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const unread = items.filter((n) => !n.read_at).length;

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        setItems((prev) => [payload.new as Notification, ...prev].slice(0, 12));
        router.refresh();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, router]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  async function markRead(ids?: string[]) {
    const supabase = createClient();
    const now = new Date().toISOString();
    let q = supabase.from("notifications").update({ read_at: now }).eq("user_id", userId).is("read_at", null);
    if (ids) q = q.in("id", ids);
    await q;
    setItems((prev) => prev.map((n) => (!ids || ids.includes(n.id) ? { ...n, read_at: n.read_at ?? now } : n)));
  }

  return (
    <div className="relative" ref={box}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid size-10 place-items-center rounded-xl border border-line text-soft hover:text-text"
        aria-label={unread ? `Notificações, ${unread} não lidas` : "Notificações"}
        aria-expanded={open}
      >
        <Bell className="size-[18px]" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-green px-1 font-mono text-[10px] font-semibold text-bg tabular">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-[min(380px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-line-2 bg-surface shadow-2xl shadow-black/60 animate-rise">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-semibold">Notificações</p>
            {unread > 0 && (
              <button onClick={() => markRead()} className="flex items-center gap-1.5 text-xs text-blue-2 hover:text-text">
                <CheckCheck className="size-3.5" aria-hidden="true" /> Marcar todas como lidas
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-mute">Nada por aqui ainda.</li>}
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.link || "/notificacoes"}
                  onClick={() => { setOpen(false); if (!n.read_at) markRead([n.id]); }}
                  className={cx("flex gap-3 border-b border-line/60 px-4 py-3 transition-colors hover:bg-surface-2", !n.read_at && "bg-blue/[0.05]")}
                >
                  <span className={cx("mt-2 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-green")} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug">{n.title}</span>
                    {n.body && <span className="mt-0.5 block truncate text-xs text-mute">{n.body}</span>}
                    <span className="mt-1 block font-mono text-[10.5px] text-mute">{relative(n.created_at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/notificacoes" onClick={() => setOpen(false)} className="block px-4 py-3 text-center text-sm text-blue-2 hover:bg-surface-2">
            Ver todas
          </Link>
        </div>
      )}
    </div>
  );
}
