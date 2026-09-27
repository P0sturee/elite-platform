"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/actions/account";
import type { Profile } from "@/lib/types";
import { Field, FormMessage, Input } from "./ui";
import { SubmitButton } from "./ui-client";

function Toggle({ name, label, hint, defaultChecked }: { name: string; label: string; hint: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line px-4 py-3.5 hover:border-line-2">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-mute">{hint}</span>
      </span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span aria-hidden="true" className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-line-2 transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-green peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-green" />
    </label>
  );
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome" htmlFor="pf-name">
          <Input id="pf-name" name="full_name" defaultValue={profile.full_name} autoComplete="name" required />
        </Field>
        <Field label="Empresa" htmlFor="pf-company">
          <Input id="pf-company" name="company" defaultValue={profile.company} autoComplete="organization" />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="E-mail" htmlFor="pf-email" hint="Para trocar o e-mail, fale com a equipe.">
          <Input id="pf-email" value={profile.email} disabled readOnly />
        </Field>
        <Field label="WhatsApp" htmlFor="pf-phone" hint="Com DDD, só números.">
          <Input id="pf-phone" name="phone" type="tel" defaultValue={profile.phone} autoComplete="tel" placeholder="41999999999" />
        </Field>
      </div>
      <fieldset className="grid gap-3">
        <legend className="eyebrow mb-3 text-mute">Como você quer ser avisado</legend>
        <Toggle name="notify_email" label="E-mail" hint="Aprovações, novidades, mensagens e pagamentos." defaultChecked={profile.notify_email} />
        <Toggle name="notify_whatsapp" label="WhatsApp" hint="Avisos importantes direto no seu celular." defaultChecked={profile.notify_whatsapp} />
      </fieldset>
      <FormMessage state={state} />
      <div><SubmitButton pendingText="Salvando…">Salvar</SubmitButton></div>
    </form>
  );
}
