import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft, Clock } from "lucide-react";
import { Avatar, Badge, Card, CardHeader, Select, cx } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";
import { TicketReply } from "@/components/ticket-forms";
import { updateTicket } from "@/app/actions/tickets";
import { requireUser } from "@/lib/session";
import { ticketPriority, ticketStatus } from "@/lib/labels";
import { dateTime, isPast, waNumber } from "@/lib/format";
import type { Ticket, TicketMessage } from "@/lib/types";

export const metadata: Metadata = { title: "Chamado" };

type Row = Ticket & { projects: { id: string; name: string } | null; profiles: { full_name: string; company: string; email: string; phone: string } | null };

export default async function TicketPage({ params }: PageProps<"/suporte/[id]">) {
  const { id } = await params;
  const { supabase, profile } = await requireUser();
  const admin = profile.role === "admin";
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [{ data: t }, { data: msgs }] = await Promise.all([
    supabase.from("tickets").select("*, projects(id, name), profiles(full_name, company, email, phone)").eq("id", id).maybeSingle(),
    supabase.from("ticket_messages").select("*").eq("ticket_id", id).order("created_at"),
  ]);
  if (!t) notFound();
  const ticket = t as Row;
  const messages = (msgs ?? []) as TicketMessage[];
  const st = ticketStatus[ticket.status];
  const pr = ticketPriority[ticket.priority];
  const clientName = ticket.profiles?.full_name || ticket.profiles?.email || "Cliente";
  const lastClientMsg = [...messages].reverse().find((m) => m.author_id === ticket.client_id);
  const respondBy = lastClientMsg && ["open", "in_progress"].includes(ticket.status)
    ? new Date(new Date(lastClientMsg.created_at).getTime() + pr.slaHours * 3600_000)
    : null;
  const late = respondBy ? isPast(respondBy) : false;
  const closed = ticket.status === "closed";

  return (
    <>
      <Link href="/suporte" className="mb-5 inline-flex items-center gap-1 text-sm text-mute hover:text-text">
        <ChevronLeft className="size-4" aria-hidden="true" /> Suporte
      </Link>
      <div className="mb-8 animate-rise">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-mute">#{ticket.number}</span>
          <Badge tone={st.tone} dot>{admin && ticket.status === "waiting_client" ? "Aguardando cliente" : st.label}</Badge>
          <Badge tone={pr.tone}>Prioridade {pr.label.toLowerCase()}</Badge>
        </div>
        <h1 className="display text-3xl sm:text-4xl leading-tight">{ticket.subject}</h1>
        <p className="mt-2 text-sm text-mute">
          {admin && <>{ticket.profiles?.company || clientName} · </>}
          {ticket.projects ? <Link href={`/projetos/${ticket.projects.id}`} className="text-blue-2 hover:text-text">{ticket.projects.name}</Link> : "Geral"}
          {" · aberto em "}{dateTime(ticket.created_at)}
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid content-start gap-4">
          {messages.map((m) => {
            const fromClient = m.author_id === ticket.client_id;
            const name = m.author_id === profile.id ? "Você" : fromClient ? clientName : "Elite Systems";
            return (
              <Card key={m.id} className={cx("p-5", !fromClient && "border-blue/25 bg-blue/[0.04]")}>
                <div className="mb-3 flex items-center gap-3">
                  <Avatar name={name} size={32} admin={!fromClient} />
                  <p className="text-sm font-semibold">{name}</p>
                  <p className="ml-auto font-mono text-[11px] text-mute">{dateTime(m.created_at)}</p>
                </div>
                <p className="whitespace-pre-wrap break-words text-[15px] text-soft">{m.body}</p>
              </Card>
            );
          })}
          {closed ? (
            <p className="rounded-xl border border-line px-4 py-3 text-sm text-mute">Chamado fechado. Precisa de algo mais? Abra um novo chamado.</p>
          ) : (
            <Card className="p-5"><TicketReply ticketId={ticket.id} /></Card>
          )}
        </div>

        <aside className="grid content-start gap-4">
          {respondBy && (
            <Card className={cx("p-5", late && "border-red/30")}>
              <p className="flex items-center gap-2 text-sm text-mute"><Clock className="size-4" aria-hidden="true" />Prazo de resposta</p>
              <p className={cx("display mt-1 text-xl", late && "text-red")}>{dateTime(respondBy)}</p>
              <p className="mt-1 text-xs text-mute">Prioridade {pr.label.toLowerCase()}: até {pr.slaHours} h.</p>
            </Card>
          )}
          {admin && (
            <Card>
              <CardHeader title="Gerenciar" />
              <form action={updateTicket} className="grid gap-3 p-5">
                <input type="hidden" name="id" value={ticket.id} />
                <label htmlFor="tk-status" className="text-[13px] text-soft">Status</label>
                <Select id="tk-status" name="status" defaultValue={ticket.status}>
                  {Object.entries(ticketStatus).map(([k, s]) => <option key={k} value={k}>{k === "waiting_client" ? "Aguardando cliente" : s.label}</option>)}
                </Select>
                <label htmlFor="tk-priority" className="text-[13px] text-soft">Prioridade</label>
                <Select id="tk-priority" name="priority" defaultValue={ticket.priority}>
                  {Object.entries(ticketPriority).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
                </Select>
                <SubmitButton size="sm" variant="ghost" pendingText="Salvando…" className="mt-1">Salvar</SubmitButton>
              </form>
              {ticket.profiles?.phone && (
                <a href={`https://wa.me/${waNumber(ticket.profiles.phone)}`} target="_blank" rel="noopener"
                  className="block border-t border-line px-5 py-3 text-sm text-green hover:bg-surface-2">
                  Chamar {clientName.split(" ")[0]} no WhatsApp
                </a>
              )}
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
