import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, FileWarning, Inbox, LifeBuoy, UserPlus, Wallet } from "lucide-react";
import { Card, CardHeader, PageHeader, Stat, ButtonLink, cx } from "@/components/ui";
import { requireAdmin } from "@/lib/session";
import { brl, date, relative, todayISO } from "@/lib/format";
import type { Approval, Installment, Notification, Profile, ProjectRequest, Ticket } from "@/lib/types";

export const metadata: Metadata = { title: "Visão geral" };

export default async function AdminHome() {
  const { supabase, profile } = await requireAdmin();
  const today = todayISO();
  const monthStart = today.slice(0, 8) + "01";

  const [pendingClients, requests, activeProjects, approvalsOpen, changes, installments, paidMonth, tickets, activity] = await Promise.all([
    supabase.from("profiles").select("id, full_name, company, email, created_at").eq("role", "client").eq("status", "pending").order("created_at", { ascending: false }),
    supabase.from("project_requests").select("*, profiles(full_name, company, email)").eq("status", "new").order("created_at", { ascending: false }),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("approvals").select("*, projects(name)").eq("status", "changes_requested").order("decided_at", { ascending: false }).limit(5),
    supabase.from("installments").select("*, projects(name)").eq("status", "pending").order("due_date"),
    supabase.from("installments").select("amount_cents").eq("status", "paid").gte("paid_at", monthStart),
    supabase.from("tickets").select("*, profiles(full_name, company)").in("status", ["open", "in_progress"]).order("updated_at"),
    supabase.from("notifications").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(8),
  ]);

  const open = (installments.data ?? []) as (Installment & { projects: { name: string } | null })[];
  const overdue = open.filter((i) => i.due_date < today);
  const receivedMonth = (paidMonth.data ?? []).reduce((s, i) => s + i.amount_cents, 0);
  const toReceive = open.reduce((s, i) => s + i.amount_cents, 0);
  const newClients = (pendingClients.data ?? []) as Pick<Profile, "id" | "full_name" | "company" | "email" | "created_at">[];
  const newRequests = (requests.data ?? []) as (ProjectRequest & { profiles: { full_name: string; company: string; email: string } | null })[];
  const changeRequests = (changes.data ?? []) as (Approval & { projects: { name: string } | null })[];
  const openTickets = (tickets.data ?? []) as (Ticket & { profiles: { full_name: string; company: string } | null })[];
  const feed = (activity.data ?? []) as Notification[];

  const todo = [
    ...newClients.map((c) => ({ key: c.id, href: "/admin/clientes?status=pending", icon: UserPlus, tone: "amber",
      title: `Aprovar cadastro: ${c.full_name || c.email}`, meta: `${c.company || c.email} · ${relative(c.created_at)}` })),
    ...newRequests.map((r) => ({ key: r.id, href: "/admin/pedidos", icon: Inbox, tone: "blue",
      title: `Novo pedido: ${r.types.join(" + ")}`, meta: `${r.profiles?.company || r.profiles?.full_name || ""} · ${relative(r.created_at)}` })),
    ...changeRequests.map((a) => ({ key: a.id, href: `/projetos/${a.project_id}/aprovacoes`, icon: FileWarning, tone: "red",
      title: `Ajustes pedidos: ${a.title}`, meta: `${a.projects?.name ?? ""} · ${a.decision_note.slice(0, 80)}` })),
    ...overdue.map((i) => ({ key: i.id, href: `/projetos/${i.project_id}/financeiro`, icon: Wallet, tone: "red",
      title: `Parcela vencida: ${brl(i.amount_cents)}`, meta: `${i.projects?.name ?? ""} · venceu em ${date(i.due_date)}` })),
    ...openTickets.map((t) => ({ key: t.id, href: `/suporte/${t.id}`, icon: LifeBuoy, tone: t.priority === "urgent" ? "red" : "amber",
      title: `Chamado #${t.number}: ${t.subject}`, meta: `${t.profiles?.company || t.profiles?.full_name || ""} · prioridade ${t.priority}` })),
  ];

  return (
    <>
      <PageHeader
        eyebrow="Painel da equipe"
        title={`Bom trabalho, ${(profile.full_name || "equipe").split(" ")[0]}.`}
        description={todo.length ? `${todo.length} ${todo.length === 1 ? "item precisa" : "itens precisam"} de você hoje.` : "Nada pendente. Hora de construir."}
        actions={<ButtonLink href="/projetos/novo">Novo projeto</ButtonLink>}
      />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Projetos ativos" value={activeProjects.count ?? 0} />
        <Stat label="Aprovações com clientes" value={approvalsOpen.count ?? 0} hint="aguardando resposta" />
        <Stat label="Recebido no mês" value={brl(receivedMonth)} tone="green" hint="parcelas pagas" />
        <Stat label="A receber" value={brl(toReceive)} hint={overdue.length ? `${brl(overdue.reduce((s, i) => s + i.amount_cents, 0))} vencido` : "nada vencido"} tone={overdue.length ? "red" : undefined} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="Precisa de você" eyebrow="Fila de trabalho" />
          {todo.length ? (
            <ul className="divide-y divide-line">
              {todo.map(({ key, href, icon: Icon, tone, title, meta }) => (
                <li key={key}>
                  <Link href={href} className="group flex items-center gap-4 px-5 py-3.5 hover:bg-surface-2/60">
                    <span className={cx("grid size-9 shrink-0 place-items-center rounded-xl",
                      tone === "red" ? "bg-red/12 text-red" : tone === "amber" ? "bg-amber/12 text-amber" : "bg-blue/12 text-blue-2")}>
                      <Icon className="size-[18px]" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{title}</span>
                      <span className="block truncate text-xs text-mute">{meta}</span>
                    </span>
                    <ArrowRight className="size-4 text-mute group-hover:text-text" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-mute">Fila vazia. Novos cadastros, pedidos e chamados aparecem aqui.</p>
          )}
        </Card>
        <Card>
          <CardHeader title="Atividade recente" />
          {feed.length ? (
            <ul className="divide-y divide-line">
              {feed.map((n) => (
                <li key={n.id}>
                  <Link href={n.link || "/notificacoes"} className="block px-5 py-3 hover:bg-surface-2/60">
                    <span className="block text-sm leading-snug">{n.title}</span>
                    <span className="font-mono text-[10.5px] text-mute">{relative(n.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-mute">Sem atividade ainda.</p>
          )}
        </Card>
      </div>
    </>
  );
}
