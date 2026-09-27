import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, Stat, cx } from "@/components/ui";
import { InstallmentsForm, PixPanel } from "@/components/finance-forms";
import { deleteInstallment, setInstallmentStatus } from "@/app/actions/finance";
import { getProject } from "@/lib/project-data";
import { installmentStatus } from "@/lib/labels";
import { financeSummary, installmentState } from "@/lib/project";
import { brl, date } from "@/lib/format";
import { pixPayload } from "@/lib/pix";
import { guessPixKeyType, normalizePixKey } from "@/lib/pix-key";
import type { Installment, Settings } from "@/lib/types";

export const metadata: Metadata = { title: "Financeiro" };

function StatusButton({ id, status, label, danger }: { id: string; status: string; label: string; danger?: boolean }) {
  return (
    <form action={setInstallmentStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={cx("h-8 rounded-full px-3 text-xs ring-1 ring-inset transition-colors",
        danger ? "text-red ring-red/30 hover:bg-red/10" : "text-green ring-green/30 hover:bg-green/10")}>{label}</button>
    </form>
  );
}

export default async function FinancePage({ params }: PageProps<"/projetos/[id]/financeiro">) {
  const { id } = await params;
  const { supabase, project, admin } = await getProject(id);
  const [{ data }, { data: settingsData }] = await Promise.all([
    supabase.from("installments").select("*").eq("project_id", id).order("number"),
    supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  const items = (data ?? []) as Installment[];
  const settings = settingsData as Settings | null;
  const summary = financeSummary(items);
  const normalizedKey = settings?.pix_key
    ? normalizePixKey(settings.pix_key_type ?? guessPixKeyType(settings.pix_key), settings.pix_key)
    : null;
  const pixKey = normalizedKey && "key" in normalizedKey ? normalizedKey.key : "";
  const pixReady = !!pixKey;

  return (
    <div className={cx("grid gap-8", admin && "xl:grid-cols-[minmax(0,1fr)_340px]")}>
      <div className="grid content-start gap-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Valor do projeto" value={brl(summary.total)} />
          <Stat label="Pago" value={brl(summary.paid)} hint={summary.total ? `${Math.round((summary.paid / summary.total) * 100)}% do total` : undefined} tone="green" />
          <Stat label="Em aberto" value={brl(summary.open)} />
          <Stat label="Vencidas" value={summary.overdue.length} hint={summary.overdue.length ? brl(summary.overdue.reduce((s, i) => s + i.amount_cents, 0)) : "nenhuma"} tone={summary.overdue.length ? "red" : undefined} />
        </div>

        <Card>
          <CardHeader title="Parcelas" eyebrow="Pagamentos via Pix" />
          {items.length ? (
            <ul className="divide-y divide-line">
              {items.map((i) => {
                const state = installmentState(i);
                const st = installmentStatus[state];
                const payload = pixReady && i.status === "pending"
                  ? pixPayload({
                      key: pixKey, name: settings!.pix_name, city: settings!.pix_city,
                      amountCents: i.amount_cents, description: `Parcela ${i.number}`,
                    })
                  : "";
                const wa = settings?.support_whatsapp
                  ? `https://wa.me/${settings.support_whatsapp}?text=${encodeURIComponent(`Olá! Segue o comprovante da parcela ${i.number} (${brl(i.amount_cents)}) do projeto ${project.name}.`)}`
                  : undefined;
                return (
                  <li key={i.id} className={cx("px-5 py-4", state === "overdue" && "bg-red/[0.04]")}>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 font-mono text-xs text-soft tabular">{String(i.number).padStart(2, "0")}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{i.description || `Parcela ${i.number}`}</p>
                        <p className="font-mono text-[11px] text-mute">
                          {i.status === "paid" && i.paid_at ? `Paga em ${date(i.paid_at)}` : `Vencimento ${date(i.due_date)}`}
                        </p>
                      </div>
                      <p className="display text-lg tabular">{brl(i.amount_cents)}</p>
                      <Badge tone={st.tone} dot>{st.label}</Badge>
                      {admin && (
                        <div className="flex flex-wrap gap-1.5">
                          {i.status === "pending" && <StatusButton id={i.id} status="paid" label="Marcar como paga" />}
                          {i.status === "paid" && <StatusButton id={i.id} status="pending" label="Reabrir" danger />}
                          {i.status === "pending" && <StatusButton id={i.id} status="cancelled" label="Cancelar" danger />}
                          {i.status === "cancelled" && (
                            <form action={deleteInstallment}>
                              <input type="hidden" name="id" value={i.id} />
                              <button className="h-8 rounded-full px-3 text-xs text-red ring-1 ring-inset ring-red/30 hover:bg-red/10">Apagar</button>
                            </form>
                          )}
                        </div>
                      )}
                    </div>
                    {!admin && i.status === "pending" && (
                      <div className="mt-3 sm:pl-14">
                        {payload ? <PixPanel payload={payload} whatsappHref={wa} /> : <p className="text-sm text-mute">A chave Pix ainda não foi configurada. Fale com a equipe para receber os dados de pagamento.</p>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={<Wallet className="size-5" />} title="Nenhuma parcela cadastrada">
              {admin ? "Cadastre o valor do projeto e as parcelas ao lado." : "Os pagamentos do projeto aparecem aqui, com Pix copia e cola."}
            </EmptyState>
          )}
        </Card>
        {!admin && items.some((i) => i.status === "pending") && (
          <p className="text-sm text-mute">Depois de pagar, a equipe confirma o recebimento e você recebe um aviso aqui na plataforma.</p>
        )}
      </div>

      {admin && (
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader title="Novas parcelas" eyebrow="Painel da equipe" />
            <InstallmentsForm projectId={id} />
          </Card>
          {!pixReady && (
            <p className="rounded-xl bg-amber/10 px-4 py-3 text-sm text-amber">
              Configure sua chave Pix em Configurações para o cliente ver o QR Code.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
