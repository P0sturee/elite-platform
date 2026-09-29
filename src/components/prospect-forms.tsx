"use client";

import { useActionState, type ReactNode } from "react";
import { Pause, Play, Search } from "lucide-react";
import {
  addSearches, runSearchNow, saveProspectKey, saveProspectSettings, sendLeadMessage, toggleProspecting,
} from "@/app/actions/prospect";
import type { ProspectSettings } from "@/lib/types";
import { Badge, Field, FormMessage, Input, Select, Textarea } from "./ui";
import { SubmitButton } from "./ui-client";

export function ProspectToggle({ enabled }: { enabled: boolean }) {
  const [state, action] = useActionState(toggleProspecting, undefined);
  return (
    <form action={action} className="grid justify-items-start gap-3">
      <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
      <SubmitButton variant={enabled ? "danger" : "success"} pendingText={enabled ? "Pausando…" : "Ligando…"}>
        {enabled ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
        {enabled ? "Pausar robô" : "Ligar robô"}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

export function ProspectSettingsForm({ settings }: { settings: ProspectSettings }) {
  const [state, action] = useActionState(saveProspectSettings, undefined);
  return (
    <form action={action} className="grid gap-5 p-5">
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Limite por dia" htmlFor="daily_max" hint="Teto depois do aquecimento (5 a 60).">
          <Input id="daily_max" name="daily_max" type="number" min={5} max={60} defaultValue={settings.daily_max} required />
        </Field>
        <Field label="Começa às" htmlFor="window_start">
          <Select id="window_start" name="window_start" defaultValue={settings.window_start}>
            {HOURS.map((h) => <option key={h} value={h}>{h}h</option>)}
          </Select>
        </Field>
        <Field label="Para às" htmlFor="window_end">
          <Select id="window_end" name="window_end" defaultValue={settings.window_end}>
            {HOURS.map((h) => <option key={h} value={h}>{h}h</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Seu nome nas mensagens" htmlFor="sender_name" hint="Vazio = primeiro nome da sua conta.">
          <Input id="sender_name" name="sender_name" defaultValue={settings.sender_name} maxLength={40} />
        </Field>
        <label className="flex items-center gap-3 self-end rounded-xl border border-line px-4 py-3 text-sm text-soft">
          <input type="checkbox" name="weekdays_only" defaultChecked={settings.weekdays_only} className="size-4 accent-[var(--color-blue)]" />
          Enviar só de segunda a sexta
        </label>
      </div>
      <Field label="Mensagens de abertura" htmlFor="openers"
        hint={<>Uma por bloco, separadas por uma linha com <code>---</code>. O robô sorteia uma para cada empresa. Use {"{empresa}"}, {"{nome}"} e {"{saudacao}"}; mantenha o “responda SAIR”.</>}>
        <Textarea id="openers" name="openers" defaultValue={settings.openers.join("\n---\n")} className="min-h-56 font-mono text-[13px]" />
      </Field>
      <Field label="O que a IA sabe sobre o OrçaPro" htmlFor="pitch" hint="A IA só usa o que está aqui para responder — inclua preços se quiser que ela fale deles.">
        <Textarea id="pitch" name="pitch" defaultValue={settings.pitch} className="min-h-56 text-[13px]" />
      </Field>
      <FormMessage state={state} />
      <div><SubmitButton pendingText="Salvando…">Salvar ajustes</SubmitButton></div>
    </form>
  );
}

export function ProspectKeyForm({ name, label, configured, hint }: { name: string; label: string; configured: boolean; hint: ReactNode }) {
  const [state, action] = useActionState(saveProspectKey, undefined);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="name" value={name} />
      <p className="flex items-center gap-2 text-sm font-medium">
        {label} {configured ? <Badge tone="green" dot>Cadastrada</Badge> : <Badge tone="amber" dot>Falta</Badge>}
      </p>
      <div className="flex flex-wrap gap-2">
        <Input name="value" type="password" autoComplete="off" placeholder={configured ? "Colar nova chave para trocar" : "Colar a chave"} className="min-w-0 flex-1" aria-label={label} />
        <SubmitButton variant="subtle" pendingText="Salvando…">Salvar</SubmitButton>
      </div>
      <p className="text-xs text-mute">{hint}</p>
      <FormMessage state={state} />
    </form>
  );
}

export function SearchAddForm() {
  const [state, action] = useActionState(addSearches, undefined);
  return (
    <form action={action} className="grid gap-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Segmentos" htmlFor="segments" hint="Um por linha ou separados por vírgula.">
          <Textarea id="segments" name="segments" placeholder={"eletricista\nassistência técnica de celular\noficina mecânica"} className="min-h-28" />
        </Field>
        <Field label="Cidades" htmlFor="cities" hint="Cada segmento é buscado em cada cidade.">
          <Textarea id="cities" name="cities" placeholder={"Curitiba\nSão José dos Pinhais"} className="min-h-28" />
        </Field>
      </div>
      <FormMessage state={state} />
      <div><SubmitButton pendingText="Adicionando…">Adicionar buscas</SubmitButton></div>
    </form>
  );
}

export function RunSearchButton({ id }: { id: string }) {
  const [state, action] = useActionState(runSearchNow, undefined);
  return (
    <form action={action} className="grid justify-items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <SubmitButton size="sm" variant="ghost" pendingText="Buscando…"><Search className="size-3.5" aria-hidden="true" />Buscar agora</SubmitButton>
      {state && <p className={`max-w-56 text-right text-xs ${state.error ? "text-red" : "text-green"}`}>{state.error ?? state.message}</p>}
    </form>
  );
}

export function LeadReplyForm({ id }: { id: string }) {
  const [state, action] = useActionState(sendLeadMessage, undefined);
  return (
    <form action={action} className="grid gap-3 border-t border-line p-5">
      <input type="hidden" name="id" value={id} />
      <label htmlFor="text" className="text-[13px] font-medium text-soft">Responder por aqui (sai do número da Elite)</label>
      <Textarea id="text" name="text" className="min-h-20" placeholder="Ex.: Pode ser quinta às 10h? Te mando o link do Meet." />
      <FormMessage state={state} />
      <div><SubmitButton pendingText="Enviando…">Enviar no WhatsApp</SubmitButton></div>
    </form>
  );
}
