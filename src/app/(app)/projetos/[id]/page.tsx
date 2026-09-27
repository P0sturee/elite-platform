import { Check, Megaphone, Trash2 } from "lucide-react";
import { Badge, Card, CardHeader, Progress, cx } from "@/components/ui";
import { StageEditor, UpdateComposer } from "@/components/project-admin-forms";
import { deleteUpdate } from "@/app/actions/projects";
import { getProject } from "@/lib/project-data";
import { stageStatus } from "@/lib/labels";
import { date, relative } from "@/lib/format";
import type { ProjectUpdate } from "@/lib/types";

export default async function ProjectOverview({ params }: PageProps<"/projetos/[id]">) {
  const { id } = await params;
  const { supabase, project, admin } = await getProject(id);
  const { data } = await supabase.from("project_updates").select("*").eq("project_id", id).order("created_at", { ascending: false });
  const updates = (data ?? []) as ProjectUpdate[];
  const stages = project.project_stages;
  const stageName = Object.fromEntries(stages.map((s) => [s.id, s.name]));

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader title="Linha do tempo" eyebrow="Etapas do projeto" />
        <ol className="p-5 sm:p-6">
          {stages.map((s, i) => {
            const st = stageStatus[s.status];
            const last = i === stages.length - 1;
            return (
              <li key={s.id} className="relative flex gap-4 pb-8 last:pb-0">
                {!last && (
                  <span aria-hidden="true" className={cx("absolute left-[19px] top-11 bottom-1 w-0.5 rounded-full",
                    s.status === "done" ? "bg-gradient-to-b from-green to-green/40" : "bg-line")} />
                )}
                <span aria-hidden="true" className={cx(
                  "relative z-10 grid size-10 shrink-0 place-items-center rounded-full font-mono text-xs",
                  s.status === "done" && "bg-green text-bg",
                  s.status === "in_progress" && "bg-blue text-white ring-4 ring-blue/20",
                  s.status === "pending" && "border border-line-2 bg-surface-2 text-mute",
                )}>
                  {s.status === "done" ? <Check className="size-4" strokeWidth={3} /> : String(s.position).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1 pt-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className={cx("font-semibold", s.status === "pending" && "text-soft")}>{s.name}</h3>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-mute">{s.description}</p>
                  {s.status === "in_progress" && (
                    <div className="mt-3 flex max-w-sm items-center gap-3">
                      <Progress value={s.progress} />
                      <span className="font-mono text-xs text-soft tabular">{s.progress}%</span>
                    </div>
                  )}
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-mute">
                    {s.started_at && <span>Início {date(s.started_at)}</span>}
                    {s.completed_at && <span className="text-green">Concluída {date(s.completed_at)}</span>}
                    {s.due_date && s.status !== "done" && <span>Prazo {date(s.due_date)}</span>}
                  </p>
                  {admin && <StageEditor stage={s} />}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid content-start gap-6">
        <Card>
          <CardHeader title="Informações" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-5 text-sm">
            <div><dt className="text-mute">Início</dt><dd className="mt-0.5 font-medium">{date(project.start_date)}</dd></div>
            <div><dt className="text-mute">Previsão</dt><dd className="mt-0.5 font-medium">{date(project.due_date)}</dd></div>
            <div><dt className="text-mute">Etapas concluídas</dt><dd className="mt-0.5 font-medium tabular">{stages.filter((s) => s.status === "done").length} de {stages.length}</dd></div>
            <div><dt className="text-mute">Atualizado</dt><dd className="mt-0.5 font-medium">{relative(project.updated_at)}</dd></div>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Novidades" eyebrow="Diário do projeto" />
          {admin && <div className="border-b border-line"><UpdateComposer projectId={id} stages={stages} /></div>}
          {updates.length ? (
            <ul className="divide-y divide-line">
              {updates.map((u) => (
                <li key={u.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <Megaphone className="mt-0.5 size-4 shrink-0 text-blue-2" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug">{u.title}</p>
                      {u.body && <p className="mt-1.5 whitespace-pre-line text-sm text-soft">{u.body}</p>}
                      <p className="mt-2 font-mono text-[11px] text-mute">
                        {u.stage_id && stageName[u.stage_id] ? `${stageName[u.stage_id]} · ` : ""}{relative(u.created_at)}
                      </p>
                    </div>
                    {admin && (
                      <form action={deleteUpdate}>
                        <input type="hidden" name="id" value={u.id} />
                        <button className="grid size-8 place-items-center rounded-lg text-mute hover:bg-red/10 hover:text-red" aria-label="Apagar novidade" title="Apagar">
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-mute">
              {admin ? "Publique a primeira novidade — o cliente recebe um aviso." : "A equipe publica aqui cada avanço do projeto."}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
