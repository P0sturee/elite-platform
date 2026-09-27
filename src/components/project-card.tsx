import Link from "next/link";
import { ArrowUpRight, CalendarClock } from "lucide-react";
import { Badge, Progress } from "./ui";
import { projectStatus } from "@/lib/labels";
import { currentStage, projectProgress } from "@/lib/project";
import { date } from "@/lib/format";
import type { Project, Stage } from "@/lib/types";

export type ProjectWithStages = Project & {
  project_stages: Pick<Stage, "status" | "progress" | "position" | "name">[];
  profiles?: { full_name: string; company: string; email: string } | null;
};

export function ProjectCard({ project, showClient }: { project: ProjectWithStages; showClient?: boolean }) {
  const progress = projectProgress(project.project_stages);
  const stage = currentStage(project.project_stages);
  const status = projectStatus[project.status];
  const client = project.profiles ? project.profiles.company || project.profiles.full_name || project.profiles.email : "";
  return (
    <Link
      href={`/projetos/${project.id}`}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-5 transition-colors hover:border-blue/50"
    >
      <div className="pointer-events-none absolute -top-24 -right-24 size-56 rounded-full bg-blue/10 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow text-mute">{showClient && client ? client : project.kind || "Projeto"}</p>
          <h3 className="display mt-1.5 text-xl leading-tight">{project.name}</h3>
        </div>
        <ArrowUpRight className="size-5 shrink-0 text-mute transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-blue-2" aria-hidden="true" />
      </div>
      <div className="relative">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-soft">
            {project.status === "done" ? "Projeto entregue" : stage ? <>Etapa atual: <span className="text-text">{stage.name}</span></> : "—"}
          </span>
          <span className="font-mono text-xs text-mute tabular">{progress}%</span>
        </div>
        <Progress value={progress} />
      </div>
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <Badge tone={status.tone} dot>{status.label}</Badge>
        {project.due_date && (
          <span className="flex items-center gap-1.5 text-xs text-mute">
            <CalendarClock className="size-3.5" aria-hidden="true" /> Previsão {date(project.due_date)}
          </span>
        )}
      </div>
    </Link>
  );
}
