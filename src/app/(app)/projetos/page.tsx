import Link from "next/link";
import type { Metadata } from "next";
import { FolderKanban, Plus } from "lucide-react";
import { ButtonLink, Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { ProjectCard, type ProjectWithStages } from "@/components/project-card";
import { requireUser } from "@/lib/session";
import { projectStatus } from "@/lib/labels";
import type { ProjectStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Projetos" };

const filters: (ProjectStatus | "todos")[] = ["todos", "active", "paused", "done", "cancelled"];

export default async function ProjectsPage({ searchParams }: PageProps<"/projetos">) {
  const { supabase, profile } = await requireUser();
  const admin = profile.role === "admin";
  const sp = await searchParams;
  const filter = (typeof sp.status === "string" ? sp.status : "todos") as ProjectStatus | "todos";

  let query = supabase
    .from("projects")
    .select("*, project_stages(status, progress, position, name), profiles(full_name, company, email)")
    .order("updated_at", { ascending: false });
  if (filter !== "todos") query = query.eq("status", filter);
  if (admin && typeof sp.cliente === "string") query = query.eq("client_id", sp.cliente);
  const { data } = await query;
  const projects = (data ?? []) as ProjectWithStages[];

  return (
    <>
      <PageHeader
        eyebrow={admin ? "Todos os clientes" : "Acompanhamento"}
        title={admin ? "Projetos" : "Meus projetos"}
        description={admin ? "Todos os projetos da Elite Systems, do diagnóstico à evolução." : "Cada projeto mostra a etapa atual, aprovações, arquivos, mensagens e financeiro."}
        actions={admin ? <ButtonLink href="/projetos/novo"><Plus className="size-4" />Novo projeto</ButtonLink> : <ButtonLink href="/novo-projeto" variant="ghost">Pedir novo projeto</ButtonLink>}
      />
      <nav aria-label="Filtrar por status" className="mb-6 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f}
            href={f === "todos" ? "/projetos" : `/projetos?status=${f}`}
            aria-current={filter === f ? "page" : undefined}
            className={cx("rounded-full px-3.5 py-1.5 text-sm ring-1 ring-inset transition-colors",
              filter === f ? "bg-blue/15 text-text ring-blue/40" : "text-soft ring-line hover:text-text")}
          >
            {f === "todos" ? "Todos" : projectStatus[f].label}
          </Link>
        ))}
      </nav>
      {projects.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => <ProjectCard key={p.id} project={p} showClient={admin} />)}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<FolderKanban className="size-5" />}
            title={filter === "todos" ? "Nenhum projeto ainda" : "Nenhum projeto com esse status"}
            action={admin ? <ButtonLink href="/projetos/novo">Criar projeto</ButtonLink> : <ButtonLink href="/novo-projeto">Enviar briefing</ButtonLink>}
          >
            {admin ? "Crie um projeto e vincule a um cliente — ele recebe um aviso na hora." : "Quando a equipe criar seu projeto, ele aparece aqui."}
          </EmptyState>
        </Card>
      )}
    </>
  );
}
