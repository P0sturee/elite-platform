import type { Metadata } from "next";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { SettingsForm } from "@/components/settings-form";
import { requireAdmin } from "@/lib/session";
import type { Settings } from "@/lib/types";

export const metadata: Metadata = { title: "Configurações" };

function Check({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className="flex gap-3 px-5 py-3.5">
      {ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green" aria-hidden="true" /> : <CircleAlert className="mt-0.5 size-5 shrink-0 text-amber" aria-hidden="true" />}
      <div>
        <p className="text-sm font-medium">{label} <span className="sr-only">{ok ? "configurado" : "pendente"}</span></p>
        <p className="text-xs text-mute">{hint}</p>
      </div>
    </li>
  );
}

export default async function ConfigPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("settings").select("*").eq("id", 1).single();
  const settings = data as Settings;
  const env = (k: string) => !!process.env[k];

  return (
    <>
      <PageHeader eyebrow="Painel da equipe" title="Configurações" />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="Pagamentos via Pix" eyebrow="Financeiro" />
          <SettingsForm settings={settings} />
        </Card>
        <Card className="h-fit">
          <CardHeader title="Entrega de avisos" eyebrow="Status" />
          <ul className="divide-y divide-line">
            <Check ok={env("NOTIFY_SECRET") && env("SUPABASE_SERVICE_ROLE_KEY")} label="Disparo automático" hint="NOTIFY_SECRET e SUPABASE_SERVICE_ROLE_KEY na Vercel + app_url no Supabase." />
            <Check ok={env("RESEND_API_KEY")} label="E-mail (Resend)" hint={env("RESEND_API_KEY") ? `Enviando como ${process.env.EMAIL_FROM ?? "—"}` : "Defina RESEND_API_KEY e EMAIL_FROM na Vercel."} />
            <Check ok={env("WHATSAPP_TOKEN") && env("WHATSAPP_PHONE_NUMBER_ID")} label="WhatsApp (API oficial da Meta)" hint="Defina WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID e o modelo aprovado em WHATSAPP_TEMPLATE." />
            <Check ok={!!settings?.pix_key} label="Chave Pix" hint="Sem chave, o cliente não vê o QR Code." />
          </ul>
        </Card>
      </div>
    </>
  );
}
