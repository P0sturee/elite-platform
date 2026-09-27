import Link from "next/link";
import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import { markAllNotificationsRead } from "@/app/actions/account";
import { requireUser } from "@/lib/session";
import { dateTime } from "@/lib/format";
import type { Notification } from "@/lib/types";

export const metadata: Metadata = { title: "Notificações" };

export default async function NotificationsPage() {
  const { supabase, profile } = await requireUser();
  const { data } = await supabase
    .from("notifications").select("*").eq("user_id", profile.id)
    .order("created_at", { ascending: false }).limit(100);
  const items = (data ?? []) as Notification[];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <>
      <PageHeader
        eyebrow="Avisos"
        title="Notificações"
        description={profile.role === "admin" ? undefined : "Você também recebe esses avisos por e-mail e WhatsApp, conforme suas preferências em Minha conta."}
        actions={unread > 0 ? (
          <form action={markAllNotificationsRead}><SubmitButton variant="ghost" size="sm" pendingText="Marcando…">Marcar todas como lidas</SubmitButton></form>
        ) : undefined}
      />
      <Card>
        {items.length ? (
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id}>
                <Link href={n.link || "#"} className={cx("flex gap-4 px-5 py-4 hover:bg-surface-2/60", !n.read_at && "bg-blue/[0.05]")}>
                  <span className={cx("mt-2 size-2 shrink-0 rounded-full", n.read_at ? "bg-line-2" : "bg-green")} aria-label={n.read_at ? undefined : "Não lida"} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{n.title}</span>
                    {n.body && <span className="block text-sm text-mute">{n.body}</span>}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-mute">{dateTime(n.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Bell className="size-5" />} title="Nenhuma notificação">
            Avisos sobre etapas, aprovações, mensagens e pagamentos aparecem aqui.
          </EmptyState>
        )}
      </Card>
    </>
  );
}
