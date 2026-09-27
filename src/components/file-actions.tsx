"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fileDownloadUrl, registerFile } from "@/app/actions/files";
import { fileCategory } from "@/lib/labels";
import type { FileCategory } from "@/lib/types";
import { buttonClass, Select } from "./ui";

const MAX_BYTES = 50 * 1024 * 1024;

export function DownloadButton({ fileId, label = "Baixar" }: { fileId: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass("ghost", "sm")}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          window.location.href = await fileDownloadUrl(fileId);
        } catch (e) {
          alert(e instanceof Error ? e.message : "Não foi possível baixar.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
      {label}
    </button>
  );
}

export function FileUploader({ projectId, admin }: { projectId: string; admin: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<FileCategory>("entrega");
  const [status, setStatus] = useState<{ busy: boolean; text?: string; error?: boolean }>({ busy: false });
  const [dragging, setDragging] = useState(false);
  const router = useRouter();

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const supabase = createClient();
    setStatus({ busy: true, text: `Enviando ${files.length} arquivo(s)…` });
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) throw new Error(`"${file.name}" passa de 50 MB.`);
        const safe = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "-");
        const path = `${projectId}/${crypto.randomUUID()}-${safe}`;
        const { error } = await supabase.storage.from("project-files").upload(path, file, { contentType: file.type || undefined });
        if (error) throw new Error(`Falha ao enviar "${file.name}".`);
        await registerFile({ projectId, name: file.name, path, size: file.size, mime: file.type, category: admin ? category : "outro" });
      }
      setStatus({ busy: false, text: "Arquivos enviados." });
      router.refresh();
    } catch (e) {
      setStatus({ busy: false, error: true, text: e instanceof Error ? e.message : "Falha no envio." });
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); }}
      className={`flex flex-col items-center gap-3 rounded-2xl border border-dashed p-6 text-center transition-colors ${dragging ? "border-green bg-green/5" : "border-line-2"}`}
    >
      <Upload className="size-6 text-blue-2" aria-hidden="true" />
      <p className="text-sm text-soft">Arraste arquivos aqui ou</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {admin && (
          <Select aria-label="Categoria" value={category} onChange={(e) => setCategory(e.target.value as FileCategory)} className="h-9 w-40 text-sm">
            {Object.entries(fileCategory).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </Select>
        )}
        <button type="button" className={buttonClass("primary", "sm")} disabled={status.busy} onClick={() => input.current?.click()}>
          {status.busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Escolher arquivos
        </button>
      </div>
      <input ref={input} type="file" multiple className="sr-only" onChange={(e) => upload(e.target.files)} aria-label="Escolher arquivos" />
      <p className="text-xs text-mute">Até 50 MB por arquivo.</p>
      {status.text && <p role="status" className={`text-sm ${status.error ? "text-red" : "text-green"}`}>{status.text}</p>}
    </div>
  );
}
