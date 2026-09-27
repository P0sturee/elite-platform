"use client";

import { useActionState, useState } from "react";
import { saveSettings } from "@/app/actions/finance";
import { PIX_KEY_TYPES, type PixKeyType } from "@/lib/pix-key";
import type { Settings } from "@/lib/types";
import { Field, FormMessage, Input, Select } from "./ui";
import { SubmitButton } from "./ui-client";

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action] = useActionState(saveSettings, undefined);
  const [type, setType] = useState<PixKeyType>(settings.pix_key_type ?? "phone");
  return (
    <form action={action} className="grid gap-5 p-5">
      <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
        <Field label="Tipo de chave" htmlFor="pix_key_type">
          <Select id="pix_key_type" name="pix_key_type" value={type} onChange={(e) => setType(e.target.value as PixKeyType)}>
            {Object.entries(PIX_KEY_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
          </Select>
        </Field>
        <Field label="Chave Pix" htmlFor="pix_key" hint={settings.pix_key ? <>Salva como <span className="font-mono text-soft">{settings.pix_key}</span></> : "Digite como preferir — ajustamos para o formato do Banco Central."}>
          <Input id="pix_key" name="pix_key" defaultValue={settings.pix_key} placeholder={PIX_KEY_TYPES[type].placeholder} required />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome do recebedor" htmlFor="pix_name" hint="Como aparece no app do banco. Até 25 letras.">
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
