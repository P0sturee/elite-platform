import Link from "next/link";
import type { Metadata } from "next";
import { LifeBuoy, Plus } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { ticketPriority, ticketStatus } from "@/lib/labels";
import { relative } from "@/lib/format";
import type { Ticket } from "@/lib/types";

export const metadata: Metadata = { title: "Suporte" };

type Row = Ticket & { projects: { name: string } | null; profiles: { full_name: string; company: string; email: string } | null };

export default async function SupportPage({ searchParams }: PageProps<"/suporte">) {
  const { supabase, profile } = await requireUser();
  const admin = profile.role === "admin";
  const sp = await searchParams;
  const view = sp.ver === "fechados" ? "fechados" : "abertos";

  let query = supabase
    .from("tickets")
    .select("*, projects(name), profiles(full_name, company, email)")
    .order("updated_at", { ascending: false });
  query = view === "abertos" ? query.not("status", "in", "(resolved,closed)") : query.in("status", ["resolved", "closed"]);
  const { data } = await query;
  const tickets = (data ?? []) as Row[];

  return (
    <>
      <PageHeader
        eyebrow="Suporte"
        title={admin ? "Chamados" : "Suporte"}
        description={admin ? "Todos os chamados dos clientes, do mais recente ao mais antigo." : "Abra um chamado para dúvidas, erros ou melhorias. Respondemos dentro do prazo de cada prioridade."}
        actions={!admin && profile.status === "active" ? <ButtonLink href="/suporte/novo"><Plus className="size-4" />Abrir chamado</ButtonLink> : undefined}
      />
      <nav aria-label="Filtrar chamados" className="mb-6 flex gap-2">
        {(["abertos", "fechados"] as const).map((v) => (
          <Link key={v} href={v === "abertos" ? "/suporte" : "/suporte?ver=fechados"} aria-current={view === v ? "page" : undefined}
            className={cx("rounded-full px-3.5 py-1.5 text-sm ring-1 ring-inset", view === v ? "bg-blue/15 ring-blue/40" : "text-soft ring-line hover:text-text")}>
            {v === "abertos" ? "Em aberto" : "Resolvidos e fechados"}
          </Link>
        ))}
      </nav>
      <Card>
        {tickets.length ? (
          <ul className="divide-y divide-line">
            {tickets.map((t) => {
              const st = ticketStatus[t.status];
              const pr = ticketPriority[t.priority];
              const statusLabel = admin && t.status === "waiting_client" ? "Aguardando cliente" : st.label;
              const who = t.profiles ? t.profiles.company || t.profiles.full_name || t.profiles.email : "";
              return (
                <li key={t.id}>
                  <Link href={`/suporte/${t.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-surface-2/60">
                    <span className="font-mono text-xs text-mute tabular">#{t.number}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{t.subject}</span>
                      <span className="block truncate text-xs text-mute">
                        {[admin ? who : null, t.projects?.name, `atualizado ${relative(t.updated_at)}`].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <Badge tone={pr.tone}>{pr.label}</Badge>
                    <Badge tone={st.tone} dot>{statusLabel}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<LifeBuoy className="size-5" />} title={view === "abertos" ? "Nenhum chamado em aberto" : "Nenhum chamado fechado"}
            action={!admin && profile.status === "active" && view === "abertos" ? <ButtonLink href="/suporte/novo" variant="ghost">Abrir chamado</ButtonLink> : undefined}>
            {profile.status !== "active" && !admin ? "O suporte fica disponível depois que sua conta for aprovada." : undefined}
          </EmptyState>
        )}
      </Card>
    </>
  );
}
