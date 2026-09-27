import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { RequestForm } from "@/components/request-form";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Novo projeto" };

export default async function NewRequestPage() {
  await requireUser();
  return (
    <>
      <PageHeader
        eyebrow="Briefing"
        title="Vamos construir seu próximo sistema"
        description="Leva 2 minutos. A equipe analisa e responde em até 1 dia útil com os próximos passos."
      />
      <Card className="max-w-4xl p-5 sm:p-8">
        <RequestForm />
      </Card>
    </>
  );
}
