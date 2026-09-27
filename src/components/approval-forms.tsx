"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, PencilLine } from "lucide-react";
import { decideApproval, requestApproval } from "@/app/actions/approvals";
import type { FileRow, Stage } from "@/lib/types";
import { Button, Field, FormMessage, Input, Select, Textarea } from "./ui";
import { SubmitButton } from "./ui-client";

export function ApprovalDecision({ id }: { id: string }) {
  const [state, action] = useActionState(decideApproval, undefined);
  const [asking, setAsking] = useState(false);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="mt-4 grid gap-3">
      <input type="hidden" name="id" value={id} />
      {asking && (
        <Field label="O que precisa mudar?" htmlFor={`note-${id}`}>
          <Textarea id={`note-${id}`} name="note" placeholder="Ex.: trocar a cor do botão principal e incluir o campo CNPJ no cadastro." autoFocus />
        </Field>
      )}
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        {asking ? (
          <>
            <SubmitButton name="decision" value="changes_requested" variant="danger" size="sm" pendingText="Enviando…">Enviar pedido de ajustes</SubmitButton>
            <Button type="button" variant="subtle" size="sm" onClick={() => setAsking(false)}>Cancelar</Button>
          </>
        ) : (
          <>
            <SubmitButton name="decision" value="approved" variant="success" size="sm" pendingText="Aprovando…">
              <Check className="size-4" aria-hidden="true" /> Aprovar
            </SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAsking(true)}>
              <PencilLine className="size-4" aria-hidden="true" /> Pedir ajustes
            </Button>
          </>
        )}
      </div>
    </form>
  );
}

export function RequestApprovalForm({ projectId, stages, files }: { projectId: string; stages: Stage[]; files: Pick<FileRow, "id" | "name">[] }) {
  const [state, action] = useActionState(requestApproval, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) form.current?.reset(); }, [state]);
  return (
    <form ref={form} action={action} className="grid gap-4 p-5">
      <input type="hidden" name="project_id" value={projectId} />
      <Field label="O que o cliente precisa aprovar?" htmlFor="ap-title">
        <Input id="ap-title" name="title" placeholder="Ex.: Protótipo das telas de orçamento" required />
      </Field>
      <Field label="Descrição" htmlFor="ap-desc">
        <Textarea id="ap-desc" name="description" placeholder="O que revisar e até quando." className="min-h-20" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Link (Figma, ambiente de testes…)" htmlFor="ap-link">
          <Input id="ap-link" name="link_url" placeholder="https://" />
        </Field>
        <Field label="Etapa" htmlFor="ap-stage">
          <Select id="ap-stage" name="stage_id" defaultValue="">
            <option value="">—</option>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
      </div>
      {files.length > 0 && (
        <Field label="Arquivo anexado" htmlFor="ap-file">
          <Select id="ap-file" name="file_id" defaultValue="">
            <option value="">Nenhum</option>
            {files.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Select>
        </Field>
      )}
      <FormMessage state={state} />
      <div><SubmitButton size="sm" pendingText="Enviando…">Pedir aprovação</SubmitButton></div>
    </form>
  );
}
