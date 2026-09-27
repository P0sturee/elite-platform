"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { postUpdate, updateStage } from "@/app/actions/projects";
import { stageStatus } from "@/lib/labels";
import type { Stage } from "@/lib/types";
import { Field, FormMessage, Input, Select, Textarea } from "./ui";
import { SubmitButton } from "./ui-client";

export function StageEditor({ stage }: { stage: Stage }) {
  const [state, action] = useActionState(updateStage, undefined);
  const [status, setStatus] = useState(stage.status);
  const [progress, setProgress] = useState(stage.progress);
  return (
    <details className="group mt-3 rounded-xl border border-line bg-bg/40 open:border-line-2">
      <summary className="cursor-pointer list-none px-3.5 py-2 text-xs text-blue-2 hover:text-text [&::-webkit-details-marker]:hidden">
        Editar etapa
      </summary>
      <form action={action} className="grid gap-4 border-t border-line p-3.5 sm:grid-cols-3">
        <input type="hidden" name="id" value={stage.id} />
        <Field label="Status" htmlFor={`st-${stage.id}`}>
          <Select id={`st-${stage.id}`} name="status" value={status} onChange={(e) => setStatus(e.target.value as Stage["status"])}>
            {Object.entries(stageStatus).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </Select>
        </Field>
        <Field label={`Progresso: ${status === "done" ? 100 : status === "pending" ? 0 : progress}%`} htmlFor={`pg-${stage.id}`}>
          <input
            id={`pg-${stage.id}`} name="progress" type="range" min={0} max={100} step={5}
            value={status === "done" ? 100 : status === "pending" ? 0 : progress}
            disabled={status !== "in_progress"}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="h-11 w-full accent-[#19D98B] disabled:opacity-40"
          />
        </Field>
        <Field label="Prazo" htmlFor={`dd-${stage.id}`}>
          <Input id={`dd-${stage.id}`} name="due_date" type="date" defaultValue={stage.due_date ?? ""} />
        </Field>
        <div className="flex items-center gap-3 sm:col-span-3">
          <SubmitButton size="sm" pendingText="Salvando…">Salvar etapa</SubmitButton>
          <FormMessage state={state} />
        </div>
      </form>
    </details>
  );
}

export function UpdateComposer({ projectId, stages }: { projectId: string; stages: Stage[] }) {
  const [state, action] = useActionState(postUpdate, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) form.current?.reset(); }, [state]);
  return (
    <form ref={form} action={action} className="grid gap-4 p-5">
      <input type="hidden" name="project_id" value={projectId} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
        <Field label="Título" htmlFor="up-title">
          <Input id="up-title" name="title" placeholder="Ex.: Módulo financeiro pronto para testes" required />
        </Field>
        <Field label="Etapa" htmlFor="up-stage">
          <Select id="up-stage" name="stage_id" defaultValue="">
            <option value="">Geral</option>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Detalhes" htmlFor="up-body">
        <Textarea id="up-body" name="body" placeholder="O que foi feito, o que vem a seguir e se o cliente precisa fazer algo." />
      </Field>
      <FormMessage state={state} />
      <div><SubmitButton size="sm" pendingText="Publicando…">Publicar e avisar cliente</SubmitButton></div>
    </form>
  );
}
