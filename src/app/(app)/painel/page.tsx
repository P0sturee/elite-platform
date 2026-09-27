import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, CircleDashed, FileCheck2, LifeBuoy, Megaphone, Sparkles, Wallet } from "lucide-react";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, Stat, cx } from "@/components/ui";
import { ProjectCard, type ProjectWithStages } from "@/components/project-card";
import { requireUser } from "@/lib/session";
import { brl, date, relative } from "@/lib/format";
import { installmentState } from "@/lib/project";
import { requestStatus } from "@/lib/labels";
import type { Approval, Installment, ProjectRequest, ProjectUpdate, Ticket } from "@/lib/types";

export const metadata: Metadata = { title: "Painel" };

type WithProject<T> = T & { projects: { name: string } | null };

export default async function DashboardPage() {
  const { supabase, profile } = await requireUser();
  if (profile.role === "admin") redirect("/admin");
  const firstName = (profile.full_name || "").split(" ")[0] || "cliente";

  const [projects, approvals, installments, tickets, updates, requests] = await Promise.all([
    supabase.from("projects").select("*, project_stages(status, progress, position, name)").order("updated_at", { ascending: false }),
    supabase.from("approvals").select("*, projects(name)").eq("status", "pending").order("created_at"),
    supabase.from("installments").select("*, projects(name)").eq("status", "pending").order("due_date").limit(6),
    supabase.from("tickets").select("*").eq("status", "waiting_client"),
    supabase.from("project_updates").select("*, projects(name)").order("created_at", { ascending: false }).limit(5),
    supabase.from("project_requests").select("*").order("created_at", { ascending: false }).limit(5),
  ]);

  const projectList = (projects.data ?? []) as ProjectWithStages[];
  const pendingApprovals = (approvals.data ?? []) as WithProject<Approval>[];
  const openInstallments = (installments.data ?? []) as WithProject<Installment>[];
  const waitingTickets = (tickets.data ?? []) as Ticket[];
  const recentUpdates = (updates.data ?? []) as WithProject<ProjectUpdate>[];
  const myRequests = (requests.data ?? []) as ProjectRequest[];
  const overdue = openInstallments.filter((i) => installmentState(i) === "overdue");
  const next = openInstallments[0];

  if (profile.status === "pending" && projectList.length === 0) {
    return <PendingWelcome name={firstName} requests={myRequests} />;
  }

  const attention = [
    ...pendingApprovals.map((a) => ({
      key: a.id, href: `/projetos/${a.project_id}/aprovacoes`, icon: FileCheck2, tone: "amber" as const,
      title: `Aprovar: ${a.title}`, meta: `${a.projects?.name ?? ""} · enviado ${relative(a.created_at)}`,
    })),
    ...overdue.map((i) => ({
      key: i.id, href: `/projetos/${i.project_id}/financeiro`, icon: Wallet, tone: "red" as const,
      title: `Parcela ${i.number} vencida — ${brl(i.amount_cents)}`, meta: `${i.projects?.name ?? ""} · venceu em ${date(i.due_date)}`,
    })),
    ...waitingTickets.map((t) => ({
      key: t.id, href: `/suporte/${t.id}`, icon: LifeBuoy, tone: "blue" as const,
      title: `Chamado #${t.number} aguarda sua resposta`, meta: t.subject,
    })),
  ];

  return (
    <>
      <div className="mb-8 animate-rise">
        <p className="eyebrow mb-3 flex items-center gap-2.5 text-green"><span className="h-px w-5 bg-current" />Painel</p>
        <h1 className="display text-3xl sm:text-[42px] leading-none">Olá, {firstName}.</h1>
        <p className="mt-3 text-soft">
          {attention.length
            ? `Você tem ${attention.length} ${attention.length === 1 ? "item que precisa" : "itens que precisam"} da sua atenção.`
            : "Tudo em dia por aqui. Acompanhe o andamento dos seus projetos abaixo."}
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Projetos ativos" value={projectList.filter((p) => p.status === "active").length} />
        <Stat label="Aprovações pendentes" value={pendingApprovals.length} hint={pendingApprovals.length ? "aguardando você" : "nenhuma"} tone={pendingApprovals.length ? "amber" : undefined} />
        <Stat
          label="Próxima parcela"
          value={next ? brl(next.amount_cents) : "—"}
          hint={next ? (installmentState(next) === "overdue" ? `vencida em ${date(next.due_date)}` : `vence em ${date(next.due_date)}`) : "nada em aberto"}
          tone={next && installmentState(next) === "overdue" ? "red" : undefined}
        />
        <Stat label="Chamados aguardando você" value={waitingTickets.length} />
      </div>

      {attention.length > 0 && (
        <Card className="mb-8 border-amber/25">
          <CardHeader title="Precisa da sua atenção" eyebrow="Pendências" />
          <ul className="divide-y divide-line">
            {attention.map(({ key, href, icon: Icon, tone, title, meta }) => (
              <li key={key}>
                <Link href={href} className="group flex items-center gap-4 px-5 py-4 hover:bg-surface-2/60">
                  <span className={cx("grid size-10 shrink-0 place-items-center rounded-xl",
                    tone === "red" ? "bg-red/12 text-red" : tone === "amber" ? "bg-amber/12 text-amber" : "bg-blue/12 text-blue-2")}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{title}</span>
                    <span className="block truncate text-sm text-mute">{meta}</span>
                  </span>
                  <ArrowRight className="size-4 text-mute transition-transform group-hover:translate-x-1 group-hover:text-text" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Seus projetos</h2>
            <Link href="/novo-projeto" className="text-sm text-blue-2 hover:text-text">Pedir novo projeto</Link>
          </div>
          {projectList.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {projectList.map((p) => <ProjectCard key={p.id} project={p} />)}
            </div>
          ) : (
            <Card>
              <EmptyState icon={<Sparkles className="size-5" />} title="Nenhum projeto ainda" action={<ButtonLink href="/novo-projeto">Enviar briefing</ButtonLink>}>
                Assim que a equipe criar seu projeto, ele aparece aqui com todas as etapas.
              </EmptyState>
            </Card>
          )}
        </section>

        <aside className="grid content-start gap-6">
          <Card>
            <CardHeader title="Últimas novidades" />
            {recentUpdates.length ? (
              <ul className="divide-y divide-line">
                {recentUpdates.map((u) => (
                  <li key={u.id}>
                    <Link href={`/projetos/${u.project_id}`} className="flex gap-3 px-5 py-3.5 hover:bg-surface-2/60">
                      <Megaphone className="mt-0.5 size-4 shrink-0 text-blue-2" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium leading-snug">{u.title}</span>
                        <span className="block text-xs text-mute">{u.projects?.name} · {relative(u.created_at)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-mute">As novidades dos seus projetos aparecem aqui.</p>
            )}
          </Card>
          {myRequests.length > 0 && (
            <Card>
              <CardHeader title="Seus pedidos" />
              <ul className="divide-y divide-line">
                {myRequests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{r.types.join(" + ")}</span>
                      <span className="block text-xs text-mute">{date(r.created_at)}</span>
                    </span>
                    <Badge tone={requestStatus[r.status].tone}>{requestStatus[r.status].label}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}

function PendingWelcome({ name, requests }: { name: string; requests: ProjectRequest[] }) {
  const sent = requests.length > 0;
  const steps = [
    { done: true, title: "Conta criada", text: "Você já pode acessar a plataforma." },
    { done: sent, title: "Envie o briefing do projeto", text: "Conte o que você precisa em 2 minutos." },
    { done: false, title: "A equipe cria seu projeto", text: "Você recebe um aviso e acompanha tudo por aqui." },
  ];
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-line glow-bg p-6 sm:p-10 animate-rise">
      <div className="pointer-events-none absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_80%_20%,#000_10%,transparent_70%)]" />
      <div className="relative max-w-2xl">
        <Badge tone="amber" dot>Conta em análise</Badge>
        <h1 className="display mt-5 text-4xl sm:text-5xl leading-[0.98]">Bem-vindo, {name}.</h1>
        <p className="mt-4 text-soft">
          Sua conta foi criada. Enquanto a equipe da Elite Systems analisa, você já pode mandar o briefing do seu projeto.
        </p>
        <ol className="mt-8 grid gap-4">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              {s.done
                ? <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-green" aria-hidden="true" />
                : <CircleDashed className="mt-0.5 size-6 shrink-0 text-mute" aria-hidden="true" />}
              <div>
                <p className={cx("font-semibold", !s.done && "text-soft")}><span className="font-mono text-xs text-mute mr-2">0{i + 1}</span>{s.title}</p>
                <p className="text-sm text-mute">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
          {sent
            ? <Badge tone="green" dot>Briefing enviado em {date(requests[0]!.created_at)}</Badge>
            : <ButtonLink href="/novo-projeto">Enviar briefing <ArrowRight className="size-4" /></ButtonLink>}
          <ButtonLink href="/conta" variant="ghost">Completar meus dados</ButtonLink>
        </div>
      </div>
    </div>
  );
}
