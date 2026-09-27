import type { Metadata } from "next";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { SettingsForm } from "@/components/settings-form";
import { DeliveryPanel } from "@/components/delivery-panel";
import { deliveryStatus } from "@/app/actions/delivery";
import { requireAdmin } from "@/lib/session";
import type { Settings } from "@/lib/types";

export const metadata: Metadata = { title: "Configurações" };

export default async function ConfigPage() {
  const { supabase } = await requireAdmin();
  const [{ data }, status] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    deliveryStatus(),
  ]);
  const settings = data as Settings;

  return (
    <>
      <PageHeader eyebrow="Painel da equipe" title="Configurações" />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader title="Pagamentos via Pix" eyebrow="Financeiro" />
          <SettingsForm settings={settings} />
          {!settings?.pix_key && (
            <p className="mx-5 mb-5 rounded-xl bg-amber/10 px-4 py-3 text-sm text-amber">Sem chave Pix, o cliente não vê o QR Code das parcelas.</p>
          )}
        </Card>
        <Card className="h-fit">
          <CardHeader title="Avisos por e-mail e WhatsApp" eyebrow="Entrega" />
          <DeliveryPanel initial={status} />
        </Card>
      </div>
    </>
  );
}
