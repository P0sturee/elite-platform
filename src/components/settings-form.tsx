"use client";

import { useActionState } from "react";
import { saveSettings } from "@/app/actions/finance";
import type { Settings } from "@/lib/types";
import { Field, FormMessage, Input } from "./ui";
import { SubmitButton } from "./ui-client";

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action] = useActionState(saveSettings, undefined);
  return (
    <form action={action} className="grid gap-5 p-5">
      <Field label="Chave Pix" htmlFor="pix_key" hint="CNPJ/CPF só números, e-mail, telefone no formato +5541999999999 ou chave aleatória.">
        <Input id="pix_key" name="pix_key" defaultValue={settings.pix_key} placeholder="+5541995758534" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome do recebedor" htmlFor="pix_name" hint="Até 25 letras, sem acento.">
          <Input id="pix_name" name="pix_name" defaultValue={settings.pix_name} maxLength={25} />
        </Field>
        <Field label="Cidade" htmlFor="pix_city" hint="Até 15 letras.">
          <Input id="pix_city" name="pix_city" defaultValue={settings.pix_city} maxLength={15} />
        </Field>
      </div>
      <Field label="WhatsApp de atendimento" htmlFor="support_whatsapp" hint="Recebe os comprovantes de pagamento. Com 55 e DDD.">
        <Input id="support_whatsapp" name="support_whatsapp" defaultValue={settings.support_whatsapp} inputMode="numeric" />
      </Field>
      <FormMessage state={state} />
      <div><SubmitButton pendingText="Salvando…">Salvar</SubmitButton></div>
    </form>
  );
}
