import Link from "next/link";
import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Stat, cx } from "@/components/ui";
import { setInstallmentStatus } from "@/app/actions/finance";
import { requireAdmin } from "@/lib/session";
import { installmentStatus } from "@/lib/labels";
import { installmentState } from "@/lib/project";
import { brl, date, daysFromTodayISO, todayISO } from "@/lib/format";
import type { Installment } from "@/lib/types";

export const metadata: Metadata = { title: "Financeiro" };

type Row = Installment & { projects: { id: string; name: string; profiles: { full_name: string; company: string } | null } | null };
const views = { vencidas: "Vencidas", "a-vencer": "A vencer", pagas: "Pagas", todas: "Todas" } as const;

export default async function AdminFinancePage({ searchParams }: PageProps<"/admin/financeiro">) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const view = (typeof sp.ver === "string" && sp.ver in views ? sp.ver : "a-vencer") as keyof typeof views;
  const today = todayISO();
  const monthStart = today.slice(0, 8) + "01";

  const [{ data }, pendingAll, paidMonth] = await Promise.all([
    (() => {
      let q = supabase.from("installments").select("*, projects(id, name, profiles(full_name, company))");
      if (view === "vencidas") q = q.eq("status", "pending").lt("due_date", today).order("due_date");
      if (view === "a-vencer") q = q.eq("status", "pending").gte("due_date", today).order("due_date");
      if (view === "pagas") q = q.eq("status", "paid").order("paid_at", { ascending: false });
      if (view === "todas") q = q.order("due_date", { ascending: false });
      return q.limit(200);
    })(),
    supabase.from("installments").select("amount_cents, due_date").eq("status", "pending"),
    supabase.from("installments").select("amount_cents").eq("status", "paid").gte("paid_at", monthStart),
  ]);
  const rows = (data ?? []) as Row[];
  const pending = pendingAll.data ?? [];
  const overdueSum = pending.filter((i) => i.due_date < today).reduce((s, i) => s + i.amount_cents, 0);
  const next30 = daysFromTodayISO(30);
  const due30 = pending.filter((i) => i.due_date >= today && i.due_date <= next30).reduce((s, i) => s + i.amount_cents, 0);

  return (
    <>
      <PageHeader eyebrow="Painel da equipe" title="Financeiro" description="Parcelas de todos os projetos. Marque como paga quando o Pix cair — o cliente recebe a confirmação." />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Recebido no mês" value={brl((paidMonth.data ?? []).reduce((s, i) => s + i.amount_cents, 0))} tone="green" hint="parcelas pagas" />
        <Stat label="Próximos 30 dias" value={brl(due30)} />
        <Stat label="Vencido" value={brl(overdueSum)} tone={overdueSum ? "red" : undefined} hint={overdueSum ? "cobrar clientes" : "nada vencido"} />
        <Stat label="Total a receber" value={brl(pending.reduce((s, i) => s + i.amount_cents, 0))} />
      </div>
      <nav aria-label="Filtrar parcelas" className="mb-6 flex flex-wrap gap-2">
        {(Object.keys(views) as (keyof typeof views)[]).map((v) => (
          <Link key={v} href={`/admin/financeiro?ver=${v}`} aria-current={view === v ? "page" : undefined}
            className={cx("rounded-full px-3.5 py-1.5 text-sm ring-1 ring-inset", view === v ? "bg-blue/15 ring-blue/40" : "text-soft ring-line hover:text-text")}>
            {views[v]}
          </Link>
        ))}
      </nav>
      <Card>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-mute">
                  <th className="px-5 py-3 font-medium">Projeto</th>
                  <th className="px-3 py-3 font-medium">Parcela</th>
                  <th className="px-3 py-3 font-medium">Vencimento</th>
                  <th className="px-3 py-3 text-right font-medium">Valor</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((i) => {
                  const st = installmentStatus[installmentState(i)];
                  return (
                    <tr key={i.id}>
                      <td className="px-5 py-3">
                        <Link href={`/projetos/${i.project_id}/financeiro`} className="font-medium hover:text-blue-2">{i.projects?.name}</Link>
                        <p className="text-xs text-mute">{i.projects?.profiles?.company || i.projects?.profiles?.full_name}</p>
                      </td>
                      <td className="px-3 py-3 text-soft">{i.description || `Parcela ${i.number}`}</td>
                      <td className="px-3 py-3 font-mono text-xs tabular">{i.status === "paid" && i.paid_at ? `pago ${date(i.paid_at)}` : date(i.due_date)}</td>
                      <td className="px-3 py-3 text-right font-medium tabular">{brl(i.amount_cents)}</td>
                      <td className="px-3 py-3"><Badge tone={st.tone} dot>{st.label}</Badge></td>
                      <td className="px-5 py-3 text-right">
                        {i.status === "pending" && (
                          <form action={setInstallmentStatus}>
                            <input type="hidden" name="id" value={i.id} />
                            <input type="hidden" name="status" value="paid" />
                            <button className="h-8 rounded-full px-3 text-xs text-green ring-1 ring-inset ring-green/30 hover:bg-green/10">Marcar como paga</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<Wallet className="size-5" />} title="Nenhuma parcela aqui">Cadastre parcelas na aba Financeiro de cada projeto.</EmptyState>
        )}
      </Card>
    </>
  );
}
