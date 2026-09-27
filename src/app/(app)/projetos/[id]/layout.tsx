import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { Badge, ButtonLink, Progress } from "@/components/ui";
import { ProjectTabs } from "@/components/project-tabs";
import { getProject } from "@/lib/project-data";
import { projectStatus } from "@/lib/labels";
import { projectProgress } from "@/lib/project";
import { todayISO } from "@/lib/format";

export default async function ProjectLayout({ children, params }: LayoutProps<"/projetos/[id]">) {
  const { id } = await params;
  const { supabase, profile, project, admin } = await getProject(id);

  const [{ data: read }, approvals, overdue] = await Promise.all([
    supabase.from("project_reads").select("last_read_at").eq("project_id", id).eq("user_id", profile.id).maybeSingle(),
    supabase.from("approvals").select("id", { count: "exact", head: true }).eq("project_id", id).eq("status", "pending"),
    supabase.from("installments").select("id", { count: "exact", head: true }).eq("project_id", id).eq("status", "pending").lt("due_date", todayISO()),
  ]);
  const unread = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("project_id", id)
    .neq("author_id", profile.id)
    .gt("created_at", read?.last_read_at ?? "1970-01-01");

  const progress = projectProgress(project.project_stages);
  const status = projectStatus[project.status];
  const client = project.profiles;

  return (
    <>
      <Link href="/projetos" className="mb-5 inline-flex items-center gap-1 text-sm text-mute hover:text-text">
        <ChevronLeft className="size-4" aria-hidden="true" /> {admin ? "Projetos" : "Meus projetos"}
      </Link>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-5 animate-rise">
        <div className="min-w-0 max-w-2xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone={status.tone} dot>{status.label}</Badge>
            {project.kind && <span className="eyebrow text-mute">{project.kind}</span>}
            {admin && client && (
              <Link href={`/admin/clientes?c=${client.id}`} className="eyebrow text-blue-2 hover:text-text">
                {client.company || client.full_name || client.email}
              </Link>
            )}
          </div>
          <h1 className="display text-3xl sm:text-[40px] leading-[1.02]">{project.name}</h1>
          {project.summary && <p className="mt-3 text-soft">{project.summary}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {project.staging_url && (
            <ButtonLink href={project.staging_url} target="_blank" rel="noopener" variant="ghost">
              Abrir versão de testes <ExternalLink className="size-4" aria-hidden="true" />
            </ButtonLink>
          )}
          {admin && <ButtonLink href={`/projetos/${id}/editar`} variant="subtle">Editar projeto</ButtonLink>}
        </div>
      </header>
      <div className="mb-6 flex items-center gap-4">
        <Progress value={progress} className="h-2" />
        <span className="display shrink-0 text-lg tabular">{progress}%</span>
      </div>
      <ProjectTabs id={id} counts={{ approvals: approvals.count ?? 0, messages: unread.count ?? 0, overdue: overdue.count ?? 0 }} />
      {children}
    </>
  );
}
