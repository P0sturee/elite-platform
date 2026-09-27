"use client";

import { useActionState } from "react";
import { createProject, updateProject } from "@/app/actions/projects";
import { projectStatus } from "@/lib/labels";
import type { Project } from "@/lib/types";
import { Field, FormMessage, Input, Select, Textarea } from "./ui";
import { SubmitButton } from "./ui-client";

type ClientOption = { id: string; label: string };

export function ProjectForm({
  clients, project, defaults,
}: {
  clients?: ClientOption[];
  project?: Project;
  defaults?: { client_id?: string; kind?: string; summary?: string; request_id?: string };
}) {
  const [state, action] = useActionState(project ? updateProject : createProject, undefined);
  const v = project ?? defaults ?? {};
  return (
    <form action={action} className="grid gap-5">
      {project && <input type="hidden" name="id" value={project.id} />}
      {defaults?.request_id && <input type="hidden" name="request_id" value={defaults.request_id} />}
      {!project && clients && (
        <Field label="Cliente" htmlFor="client_id" hint="O cliente recebe um aviso quando o projeto é criado.">
          <Select id="client_id" name="client_id" defaultValue={defaults?.client_id ?? ""} required>
            <option value="" disabled>Escolha o cliente…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </Field>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome do projeto" htmlFor="name">
          <Input id="name" name="name" defaultValue={project?.name ?? ""} placeholder="Ex.: ERP de orçamentos" required />
        </Field>
        <Field label="Tipo" htmlFor="kind">
          <Input id="kind" name="kind" defaultValue={"kind" in v ? v.kind ?? "" : ""} placeholder="ERP, SaaS, App…" />
        </Field>
      </div>
      <Field label="Resumo" htmlFor="summary" hint="O cliente vê este texto no topo do projeto.">
        <Textarea id="summary" name="summary" defaultValue={"summary" in v ? v.summary ?? "" : ""} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Início" htmlFor="start_date">
          <Input id="start_date" name="start_date" type="date" defaultValue={project?.start_date ?? ""} />
        </Field>
        <Field label="Previsão de entrega" htmlFor="due_date">
          <Input id="due_date" name="due_date" type="date" defaultValue={project?.due_date ?? ""} />
        </Field>
        {project && (
          <Field label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={project.status}>
              {Object.entries(projectStatus).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
            </Select>
          </Field>
        )}
      </div>
      <Field label="Link do ambiente de testes" htmlFor="staging_url" hint="Aparece como botão “Abrir versão de testes” para o cliente.">
        <Input id="staging_url" name="staging_url" defaultValue={project?.staging_url ?? ""} placeholder="https://teste.seu-sistema.com" />
      </Field>
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingText="Salvando…">{project ? "Salvar alterações" : "Criar projeto"}</SubmitButton>
      </div>
    </form>
  );
}
