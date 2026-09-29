import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ArrowLeft, ExternalLink, Globe, MapPin, Star } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, cx } from "@/components/ui";
import { LeadReplyForm } from "@/components/prospect-forms";
import { updateLead } from "@/app/actions/prospect";
import { requireAdmin } from "@/lib/session";
import { leadStatus } from "@/lib/labels";
import { dateTime } from "@/lib/format";
import type { ProspectLead, ProspectMessage } from "@/lib/types";

export const metadata: Metadata = { title: "Conversa da prospecção" };

function formatPhone(p: string) {
  const d = p.replace(/^55/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : p;
}

const AUTHOR = { lead: "Empresa", bot: "Robô", admin: "Você" } as const;

export default async function LeadPage({ params }: PageProps<"/admin/prospeccao/[id]">) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [{ data: lead }, { data: messages }] = await Promise.all([
    supabase.from("prospect_leads").select("*").eq("id", id).maybeSingle<ProspectLead>(),
    supabase.from("prospect_messages").select("*").eq("lead_id", id).order("created_at"),
  ]);
  if (!lead) notFound();
  const st = leadStatus[lead.status];
  const contacted = lead.status !== "new";

  return (
    <>
      <Link href="/admin/prospeccao" className="mb-6 inline-flex items-center gap-2 text-sm text-soft hover:text-text">
        <ArrowLeft className="size-4" aria-hidden="true" /> Prospecção
      </Link>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow mb-2 text-green">{lead.category || "Empresa"}</p>
          <h1 className="display text-3xl leading-tight">{lead.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={st.tone} dot>{st.label}</Badge>
            {contacted && (lead.bot_paused ? <Badge tone="blue">Com você — robô em silêncio</Badge> : <Badge tone="mute">Robô respondendo</Badge>)}
          </p>
        </div>
        <a href={`https://wa.me/${lead.phone}`} target="_blank" rel="noopener"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-green px-5 text-sm font-semibold text-bg hover:bg-[#3de3a0]">
          Abrir no WhatsApp <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader eyebrow={formatPhone(lead.phone)} title="Conversa" />
          {(messages ?? []).length === 0 ? (
            <EmptyState title="Ainda sem mensagens">Esta empresa está na fila e ainda não foi contatada.</EmptyState>
          ) : (
            <ol className="grid gap-3 p-5">
              {(messages as ProspectMessage[]).map((m) => (
                <li key={m.id} className={cx("max-w-[85%]", m.direction === "out" ? "justify-self-end text-right" : "justify-self-start")}>
                  <div className={cx("whitespace-pre-line rounded-2xl px-4 py-2.5 text-left text-sm",
                    m.direction === "out" ? (m.author === "admin" ? "bg-blue/20" : "bg-green/12") : "bg-surface-2")}>
                    {m.body}
                  </div>
                  <p className="mt-1 font-mono text-[10.5px] text-mute">{AUTHOR[m.author]} · {dateTime(m.created_at)}</p>
                </li>
              ))}
            </ol>
          )}
          {contacted && !["opted_out", "no_whatsapp"].includes(lead.status) && <LeadReplyForm id={lead.id} />}
        </Card>

        <div className="grid h-fit gap-6">
          {lead.summary && (
            <Card className="p-5">
              <p className="eyebrow mb-2 text-mute">Resumo da IA</p>
              <p className="text-sm">{lead.summary}</p>
            </Card>
          )}
          {contacted && (
            <Card className="grid gap-2 p-5">
              <p className="eyebrow mb-1 text-mute">Andamento</p>
              <LeadButton id={lead.id} op="meeting" primary disabled={lead.status === "meeting"}>Reunião marcada</LeadButton>
              <LeadButton id={lead.id} op="not_interested" disabled={lead.status === "not_interested"}>Sem interesse</LeadButton>
              {lead.bot_paused
                ? <LeadButton id={lead.id} op="resume" disabled={["opted_out", "not_interested", "meeting"].includes(lead.status)}>Devolver ao robô</LeadButton>
                : <LeadButton id={lead.id} op="pause">Assumir (robô para de responder)</LeadButton>}
            </Card>
          )}
          <Card className="grid gap-3 p-5 text-sm">
            <p className="eyebrow text-mute">Empresa</p>
            {lead.address && <p className="flex items-start gap-2 text-soft"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{lead.address}</p>}
            {lead.rating != null && (
              <p className="flex items-center gap-2 text-soft"><Star className="size-4 text-amber" aria-hidden="true" />{lead.rating.toFixed(1).replace(".", ",")} ({lead.reviews ?? 0} avaliações)</p>
            )}
            {lead.website && <a href={lead.website} target="_blank" rel="noopener" className="flex items-center gap-2 truncate text-blue-2 hover:text-text"><Globe className="size-4 shrink-0" aria-hidden="true" />{lead.website.replace(/^https?:\/\//, "")}</a>}
            {lead.maps_url && <a href={lead.maps_url} target="_blank" rel="noopener" className="text-blue-2 hover:text-text">Ver no Google Maps →</a>}
            {lead.error && <p className="text-red">{lead.error}</p>}
            <p className="text-xs text-mute">Na fila desde {dateTime(lead.created_at)}{lead.contacted_at && ` · contatada em ${dateTime(lead.contacted_at)}`}</p>
          </Card>
        </div>
      </div>
    </>
  );
}

function LeadButton({ id, op, children, primary, disabled }: { id: string; op: string; children: ReactNode; primary?: boolean; disabled?: boolean }) {
  return (
    <form action={updateLead}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
      <button disabled={disabled} className={cx("h-10 w-full rounded-full px-4 text-sm font-medium disabled:opacity-40",
        primary ? "bg-green text-bg hover:bg-[#3de3a0]" : "text-soft ring-1 ring-inset ring-line-2 hover:text-text")}>
        {children}
      </button>
    </form>
  );
}
