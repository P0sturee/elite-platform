import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { RequestForm, type RequestDefaults } from "@/components/request-form";
import { requireUser } from "@/lib/session";
import { PRIORITIES, SYSTEM_TYPES, TEAM_SIZES } from "@/lib/labels";

export const metadata: Metadata = { title: "Novo projeto" };

// Codes sent by the briefing on the website (the input ids there: t-erp, tm-2, pr-3…).
const TYPE_CODES: Record<string, string> = {
  erp: SYSTEM_TYPES[0]!, saas: SYSTEM_TYPES[1]!, auto: SYSTEM_TYPES[2]!, bi: SYSTEM_TYPES[3]!, app: SYSTEM_TYPES[4]!, web: SYSTEM_TYPES[5]!,
};
const byIndex = (list: string[], value?: string | string[]) =>
  typeof value === "string" && /^[1-9]$/.test(value) ? list[Number(value) - 1] : undefined;

export default async function NewRequestPage({ searchParams }: PageProps<"/novo-projeto">) {
  await requireUser();
  const sp = await searchParams;
  const defaults: RequestDefaults = {
    types: typeof sp.tipos === "string" ? sp.tipos.split(",").map((c) => TYPE_CODES[c]).filter((t): t is string => !!t) : [],
    team: byIndex(TEAM_SIZES, sp.equipe),
    priority: byIndex(PRIORITIES, sp.prioridade),
    context: typeof sp.contexto === "string" ? sp.contexto.slice(0, 2000) : undefined,
  };
  const fromSite = !!(defaults.types?.length || defaults.team || defaults.priority || defaults.context);

  return (
    <>
      <PageHeader
        eyebrow="Briefing"
        title="Vamos construir seu próximo sistema"
        description={fromSite
          ? "Trouxemos as respostas que você marcou no site. Confira, complete se quiser e envie."
          : "Leva 2 minutos. A equipe analisa e responde em até 1 dia útil com os próximos passos."}
      />
      <Card className="max-w-4xl p-5 sm:p-8">
        <RequestForm defaults={defaults} />
      </Card>
    </>
  );
}
