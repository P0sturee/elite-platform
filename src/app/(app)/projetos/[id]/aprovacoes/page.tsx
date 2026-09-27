import type { Metadata } from "next";
import { ExternalLink, FileCheck2, Trash2 } from "lucide-react";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, cx } from "@/components/ui";
import { ApprovalDecision, RequestApprovalForm } from "@/components/approval-forms";
import { DownloadButton } from "@/components/file-actions";
import { deleteApproval } from "@/app/actions/approvals";
import { getProject } from "@/lib/project-data";
import { approvalStatus } from "@/lib/labels";
import { dateTime, relative } from "@/lib/format";
import type { Approval, FileRow } from "@/lib/types";

export const metadata: Metadata = { title: "Aprovações" };

export default async function ApprovalsPage({ params }: PageProps<"/projetos/[id]/aprovacoes">) {
  const { id } = await params;
  const { supabase, project, admin } = await getProject(id);
  const [{ data }, { data: fileData }] = await Promise.all([
    supabase.from("approvals").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("files").select("id, name").eq("project_id", id).order("created_at", { ascending: false }),
  ]);
  const approvals = ((data ?? []) as Approval[]).sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"));
  const files = (fileData ?? []) as Pick<FileRow, "id" | "name">[];
  const fileName = Object.fromEntries(files.map((f) => [f.id, f.name]));
  const stageName = Object.fromEntries(project.project_stages.map((s) => [s.id, s.name]));

  return (
    <div className={cx("grid gap-8", admin && "xl:grid-cols-[minmax(0,1fr)_380px]")}>
      <div className="grid content-start gap-4">
        {approvals.length === 0 && (
          <Card>
            <EmptyState icon={<FileCheck2 className="size-5" />} title="Nenhuma aprovação por enquanto">
              {admin ? "Peça a aprovação de protótipos e entregas — o cliente decide com um clique." : "Quando houver protótipos ou entregas para revisar, eles aparecem aqui."}
            </EmptyState>
          </Card>
        )}
        {approvals.map((a) => {
          const st = approvalStatus[a.status];
          const label = admin && a.status === "pending" ? "Aguardando cliente" : st.label;
          return (
            <Card key={a.id} className={cx("p-5", a.status === "pending" && "border-amber/30")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={st.tone} dot>{label}</Badge>
                    {a.stage_id && stageName[a.stage_id] && <span className="eyebrow text-mute">{stageName[a.stage_id]}</span>}
                  </div>
                  <h3 className="mt-2.5 text-lg font-semibold">{a.title}</h3>
                  {a.description && <p className="mt-1 whitespace-pre-line text-sm text-soft">{a.description}</p>}
                </div>
                {admin && (
                  <form action={deleteApproval}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="grid size-8 place-items-center rounded-lg text-mute hover:bg-red/10 hover:text-red" aria-label="Apagar aprovação" title="Apagar">
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </form>
                )}
              </div>
              {(a.link_url || a.file_id) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {a.link_url && (
                    <ButtonLink href={a.link_url} target="_blank" rel="noopener" variant="ghost" size="sm">
                      Abrir para revisar <ExternalLink className="size-3.5" aria-hidden="true" />
                    </ButtonLink>
                  )}
                  {a.file_id && <DownloadButton fileId={a.file_id} label={fileName[a.file_id] ? `Baixar ${fileName[a.file_id]}` : "Baixar arquivo"} />}
                </div>
              )}
              {a.status === "pending" && !admin && <ApprovalDecision id={a.id} />}
              <p className="mt-4 font-mono text-[11px] text-mute">
                Enviado {relative(a.created_at)}
                {a.decided_at && ` · respondido em ${dateTime(a.decided_at)}`}
              </p>
              {a.decision_note && (
                <p className="mt-3 rounded-xl border border-line bg-bg/40 px-3.5 py-2.5 text-sm text-soft">
                  <span className="text-mute">Comentário do cliente: </span>{a.decision_note}
                </p>
              )}
            </Card>
          );
        })}
      </div>
      {admin && (
        <Card className="h-fit">
          <CardHeader title="Pedir aprovação" eyebrow="Painel da equipe" />
          <RequestApprovalForm projectId={id} stages={project.project_stages} files={files} />
        </Card>
      )}
    </div>
  );
}
