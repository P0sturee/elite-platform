import Link from "next/link";
import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Textarea, cx } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import { updateRequest } from "@/app/actions/account";
import { requireAdmin } from "@/lib/session";
import { requestStatus } from "@/lib/labels";
import { dateTime, waNumber } from "@/lib/format";
import type { ProjectRequest, RequestStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Pedidos" };

type Row = ProjectRequest & { profiles: { id: string; full_name: string; company: string; email: string; phone: string; status: string } | null };

export default async function RequestsPage({ searchParams }: PageProps<"/admin/pedidos">) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const view = sp.ver === "arquivo" ? "arquivo" : "abertos";
  let query = supabase.from("project_requests").select("*, profiles(id, full_name, company, email, phone, status)").order("created_at", { ascending: false });
  query = view === "abertos" ? query.in("status", ["new", "in_review"]) : query.in("status", ["converted", "declined"]);
  const { data } = await query;
  const requests = (data ?? []) as Row[];

  return (
    <>
      <PageHeader eyebrow="Painel da equipe" title="Pedidos de projeto" description="Briefings enviados pelos clientes. Transforme em projeto com um clique." />
      <nav aria-label="Filtrar pedidos" className="mb-6 flex gap-2">
        {(["abertos", "arquivo"] as const).map((v) => (
          <Link key={v} href={v === "abertos" ? "/admin/pedidos" : "/admin/pedidos?ver=arquivo"} aria-current={view === v ? "page" : undefined}
            className={cx("rounded-full px-3.5 py-1.5 text-sm ring-1 ring-inset", view === v ? "bg-blue/15 ring-blue/40" : "text-soft ring-line hover:text-text")}>
            {v === "abertos" ? "Em aberto" : "Arquivados"}
          </Link>
        ))}
      </nav>
      {requests.length === 0 && (
        <Card><EmptyState icon={<Inbox className="size-5" />} title="Nenhum pedido aqui">Briefings enviados pela plataforma aparecem nesta lista.</EmptyState></Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {requests.map((r) => {
          const st = requestStatus[r.status];
          const c = r.profiles;
          const facts: [string, string][] = [
            ["Equipe", r.team_size], ["Prioridade", r.priority], ["Investimento", r.budget], ["Prazo", r.deadline],
          ].filter(([, v]) => v) as [string, string][];
          return (
            <Card key={r.id} className="flex flex-col p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow text-mute">{dateTime(r.created_at)}</p>
                  <h3 className="mt-1.5 text-lg font-semibold">{r.types.join(" + ")}</h3>
                  <p className="text-sm text-soft">
                    {c?.full_name || c?.email}{c?.company && ` · ${c.company}`}
                    {c?.phone && <> · <a href={`https://wa.me/${waNumber(c.phone)}`} target="_blank" rel="noopener" className="text-green hover:underline">WhatsApp</a></>}
                  </p>
                </div>
                <Badge tone={st.tone} dot>{st.label}</Badge>
              </div>
              {facts.length > 0 && (
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  {facts.map(([k, v]) => (
                    <div key={k}><dt className="text-xs text-mute">{k}</dt><dd>{v}</dd></div>
                  ))}
                </dl>
              )}
              <p className="mt-4 whitespace-pre-line rounded-xl border border-line bg-bg/40 px-3.5 py-3 text-sm text-soft">{r.context}</p>
              {view === "abertos" && (
                <>
                  <form action={updateRequest} className="mt-4 grid gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <label htmlFor={`note-${r.id}`} className="text-xs text-mute">Anotações internas</label>
                    <Textarea id={`note-${r.id}`} name="admin_note" defaultValue={r.admin_note} className="min-h-16" />
                    <div><SubmitButton size="sm" variant="subtle" pendingText="Salvando…">Salvar anotação</SubmitButton></div>
                  </form>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                    <ButtonLink href={`/projetos/novo?pedido=${r.id}`} size="sm">Criar projeto</ButtonLink>
                    {r.status === "new" && <StatusForm id={r.id} status="in_review" label="Marcar em análise" />}
                    <StatusForm id={r.id} status="declined" label="Recusar" danger />
                  </div>
                </>
              )}
              {r.project_id && (
                <Link href={`/projetos/${r.project_id}`} className="mt-4 text-sm text-blue-2 hover:text-text">Ver projeto criado →</Link>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}

function StatusForm({ id, status, label, danger }: { id: string; status: RequestStatus; label: string; danger?: boolean }) {
  return (
    <form action={updateRequest}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={cx("h-9 rounded-full px-3.5 text-[13px] ring-1 ring-inset", danger ? "text-red ring-red/30 hover:bg-red/10" : "text-soft ring-line-2 hover:text-text")}>
        {label}
      </button>
    </form>
  );
}
