import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { NewTicketForm } from "@/components/ticket-forms";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Abrir chamado" };

export default async function NewTicketPage({ searchParams }: PageProps<"/suporte/novo">) {
  const { supabase, profile } = await requireUser();
  if (profile.role === "admin" || profile.status !== "active") redirect("/suporte");
  const sp = await searchParams;
  const { data } = await supabase.from("projects").select("id, name").order("name");
  return (
    <>
      <PageHeader eyebrow="Suporte" title="Abrir chamado" description="Quanto mais detalhes, mais rápido resolvemos." />
      <Card className="max-w-3xl p-5 sm:p-7">
        <NewTicketForm projects={data ?? []} defaultProject={typeof sp.projeto === "string" ? sp.projeto : undefined} />
      </Card>
    </>
  );
}
