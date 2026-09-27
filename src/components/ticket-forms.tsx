"use client";

import { useActionState, useEffect, useRef } from "react";
import { createTicket, replyTicket } from "@/app/actions/tickets";
import { ticketPriority } from "@/lib/labels";
import { Field, FormMessage, Input, Select, Textarea } from "./ui";
import { SubmitButton } from "./ui-client";

export function NewTicketForm({ projects, defaultProject }: { projects: { id: string; name: string }[]; defaultProject?: string }) {
  const [state, action] = useActionState(createTicket, undefined);
  return (
    <form action={action} className="grid gap-5">
      <Field label="Assunto" htmlFor="tk-subject">
        <Input id="tk-subject" name="subject" placeholder="Ex.: Relatório de vendas não abre" required />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Projeto" htmlFor="tk-project">
          <Select id="tk-project" name="project_id" defaultValue={defaultProject ?? ""}>
            <option value="">Geral / não sei</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Prioridade" htmlFor="tk-priority" hint="Urgente: o sistema parou ou está perdendo dinheiro.">
          <Select id="tk-priority" name="priority" defaultValue="normal">
            {Object.entries(ticketPriority).map(([k, p]) => (
              <option key={k} value={k}>{p.label} — resposta em até {p.slaHours} h</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Descreva o que aconteceu" htmlFor="tk-body" hint="Diga o que você fez, o que esperava e o que apareceu. Prints ajudam — anexe na aba Arquivos do projeto.">
        <Textarea id="tk-body" name="body" className="min-h-40" required />
      </Field>
      <FormMessage state={state} />
      <div><SubmitButton pendingText="Abrindo…">Abrir chamado</SubmitButton></div>
    </form>
  );
}

export function TicketReply({ ticketId }: { ticketId: string }) {
  const [state, action] = useActionState(replyTicket, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) form.current?.reset(); }, [state]);
  return (
    <form ref={form} action={action} className="grid gap-3">
      <input type="hidden" name="ticket_id" value={ticketId} />
      <label htmlFor="tk-reply" className="sr-only">Resposta</label>
      <Textarea id="tk-reply" name="body" placeholder="Escreva sua resposta…" required />
      <FormMessage state={state?.error ? state : undefined} />
      <div><SubmitButton size="sm" pendingText="Enviando…">Responder</SubmitButton></div>
    </form>
  );
}
