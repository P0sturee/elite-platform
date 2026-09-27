"use client";

import { useActionState } from "react";
import { createRequest } from "@/app/actions/account";
import { BUDGETS, DEADLINES, PRIORITIES, SYSTEM_TYPES, TEAM_SIZES } from "@/lib/labels";
import { ButtonLink, Field, FormMessage, Textarea } from "./ui";
import { SubmitButton } from "./ui-client";

function Chips({ name, options, type, legend, defaultValue }: { name: string; options: string[]; type: "checkbox" | "radio"; legend: string; defaultValue?: string }) {
  return (
    <fieldset>
      <legend className="eyebrow mb-3 text-mute">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o} className="cursor-pointer">
            <input type={type} name={name} value={o} defaultChecked={o === defaultValue} className="peer sr-only" />
            <span className="inline-flex h-10 items-center gap-2 rounded-full border border-line-2 px-4 text-sm text-soft transition-colors hover:border-blue-2 peer-checked:border-blue peer-checked:bg-blue peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-green">
              {o}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function RequestForm() {
  const [state, action] = useActionState(createRequest, undefined);
  if (state?.ok) {
    return (
      <div className="grid gap-5">
        <FormMessage state={state} />
        <div className="flex gap-2">
          <ButtonLink href="/painel">Voltar ao painel</ButtonLink>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-8">
      <Chips legend="Que tipo de sistema?" name="types" type="checkbox" options={SYSTEM_TYPES} />
      <Chips legend="Tamanho da equipe" name="team_size" type="radio" options={TEAM_SIZES} />
      <Chips legend="Maior prioridade" name="priority" type="radio" options={PRIORITIES} />
      <div className="grid gap-8 lg:grid-cols-2">
        <Chips legend="Investimento previsto" name="budget" type="radio" options={BUDGETS} />
        <Chips legend="Prazo desejado" name="deadline" type="radio" options={DEADLINES} />
      </div>
      <Field label="O que mais trava sua operação hoje?" htmlFor="context" hint="Ex.: fazemos orçamentos no Excel e perdemos o controle das aprovações.">
        <Textarea id="context" name="context" className="min-h-36" required />
      </Field>
      <FormMessage state={state} />
      <div><SubmitButton pendingText="Enviando…">Enviar pedido</SubmitButton></div>
    </form>
  );
}
