import Link from "next/link";
import type { Metadata } from "next";
import { FileArchive, FileImage, FileText, Files, Trash2 } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, cx } from "@/components/ui";
import { DownloadButton, FileUploader } from "@/components/file-actions";
import { deleteFile } from "@/app/actions/files";
import { getProject } from "@/lib/project-data";
import { fileCategory } from "@/lib/labels";
import { date, fileSize } from "@/lib/format";
import type { FileCategory, FileRow } from "@/lib/types";

export const metadata: Metadata = { title: "Arquivos" };

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return FileImage;
  if (mime.includes("zip") || mime.includes("compressed")) return FileArchive;
  return FileText;
}

export default async function FilesPage({ params, searchParams }: PageProps<"/projetos/[id]/arquivos">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, profile, admin } = await getProject(id);
  const { data } = await supabase.from("files").select("*").eq("project_id", id).order("created_at", { ascending: false });
  const all = (data ?? []) as FileRow[];
  const cat = typeof sp.categoria === "string" && sp.categoria in fileCategory ? (sp.categoria as FileCategory) : null;
  const files = cat ? all.filter((f) => f.category === cat) : all;
  const present = Object.keys(fileCategory).filter((k) => all.some((f) => f.category === k)) as FileCategory[];

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardHeader title="Arquivos do projeto" eyebrow={`${all.length} ${all.length === 1 ? "arquivo" : "arquivos"}`} />
        {present.length > 1 && (
          <nav aria-label="Filtrar por categoria" className="flex flex-wrap gap-2 border-b border-line px-5 py-3">
            <Link href={`/projetos/${id}/arquivos`} className={cx("rounded-full px-3 py-1 text-xs ring-1 ring-inset", !cat ? "bg-blue/15 ring-blue/40" : "text-soft ring-line")}>Todos</Link>
            {present.map((k) => (
              <Link key={k} href={`/projetos/${id}/arquivos?categoria=${k}`} className={cx("rounded-full px-3 py-1 text-xs ring-1 ring-inset", cat === k ? "bg-blue/15 ring-blue/40" : "text-soft ring-line")}>
                {fileCategory[k]}
              </Link>
            ))}
          </nav>
        )}
        {files.length ? (
          <ul className="divide-y divide-line">
            {files.map((f) => {
              const Icon = iconFor(f.mime);
              const mine = f.uploaded_by === profile.id;
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-blue-2"><Icon className="size-5" aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{f.name}</p>
                    <p className="font-mono text-[11px] text-mute">{fileSize(f.size)} · {date(f.created_at)}{mine ? " · enviado por você" : ""}</p>
                  </div>
                  <Badge>{fileCategory[f.category]}</Badge>
                  <div className="flex gap-1.5">
                    <DownloadButton fileId={f.id} />
                    {(admin || mine) && (
                      <form action={deleteFile}>
                        <input type="hidden" name="id" value={f.id} />
                        <button className="grid size-9 place-items-center rounded-lg text-mute hover:bg-red/10 hover:text-red" aria-label={`Apagar ${f.name}`} title="Apagar">
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<Files className="size-5" />} title="Nenhum arquivo ainda">
            Contratos, protótipos, manuais e entregas do projeto ficam guardados aqui.
          </EmptyState>
        )}
      </Card>
      <Card className="h-fit p-5">
        <h2 className="mb-1 font-semibold">Enviar arquivos</h2>
        <p className="mb-4 text-sm text-mute">
          {admin ? "O cliente recebe um aviso a cada entrega." : "Mande logos, planilhas, documentos ou prints para a equipe."}
        </p>
        <FileUploader projectId={id} admin={admin} />
      </Card>
    </div>
  );
}
