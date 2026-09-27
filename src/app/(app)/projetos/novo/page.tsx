import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { ProjectForm } from "@/components/project-form";
import { requireAdmin } from "@/lib/session";
import type { Profile, ProjectRequest } from "@/lib/types";

export const metadata: Metadata = { title: "Novo projeto" };

export default async function NewProjectPage({ searchParams }: PageProps<"/projetos/novo">) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const requestId = typeof sp.pedido === "string" ? sp.pedido : undefined;

  const [{ data: clients }, { data: request }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, company, email").eq("role", "client").neq("status", "blocked").order("full_name"),
    requestId
      ? supabase.from("project_requests").select("*").eq("id", requestId).maybeSingle<ProjectRequest>()
      : Promise.resolve({ data: null }),
  ]);

  const options = ((clients ?? []) as Pick<Profile, "id" | "full_name" | "company" | "email">[]).map((c) => ({
    id: c.id,
    label: [c.full_name || c.email, c.company].filter(Boolean).join(" — "),
  }));

  const defaults = request
    ? {
        client_id: request.client_id,
        kind: request.types.join(" + "),
        summary: request.context,
        request_id: request.id,
      }
    : { client_id: typeof sp.cliente === "string" ? sp.cliente : undefined };

  return (
    <>
      <PageHeader
        eyebrow="Painel da equipe"
        title="Novo projeto"
        description="O projeto já nasce com as 5 etapas (Diagnóstico → Evolução). Depois você ajusta prazos, publica novidades e pede aprovações."
      />
      <Card className="max-w-3xl p-5 sm:p-7">
        {options.length ? (
          <ProjectForm clients={options} defaults={defaults} />
        ) : (
          <p className="text-soft">Nenhum cliente cadastrado ainda. Peça para o cliente criar a conta na plataforma e volte aqui.</p>
        )}
      </Card>
    </>
  );
}
