"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { QrCode } from "lucide-react";
import { createInstallments } from "@/app/actions/finance";
import { todayISO } from "@/lib/format";
import { Button, Field, FormMessage, Input } from "./ui";
import { CopyButton, SubmitButton } from "./ui-client";

export function PixPanel({ payload, whatsappHref }: { payload: string; whatsappHref?: string }) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState("");
  useEffect(() => {
    if (open && !qr) QRCode.toDataURL(payload, { margin: 1, width: 240, color: { dark: "#04060C", light: "#FFFFFF" } }).then(setQr);
  }, [open, qr, payload]);

  if (!open) {
    return (
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <QrCode className="size-4" aria-hidden="true" /> Pagar com Pix
      </Button>
    );
  }
  return (
    <div className="mt-4 grid w-full gap-4 rounded-2xl border border-line-2 bg-bg/50 p-4 sm:grid-cols-[180px_minmax(0,1fr)]">
      <div className="grid aspect-square w-full max-w-[180px] place-items-center rounded-xl bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- data: URL QR code */}
        {qr ? <img src={qr} alt="QR Code Pix" className="size-full" /> : <span className="text-xs text-bg">Gerando…</span>}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">Pix copia e cola</p>
        <p className="mt-1 text-xs text-mute">Abra o app do banco, escolha Pix → Copia e cola e cole o código. O valor já vem preenchido.</p>
        <code className="mt-3 block max-h-24 overflow-y-auto break-all rounded-lg bg-surface-2 p-2.5 font-mono text-[11px] text-soft">{payload}</code>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyButton text={payload} label="Copiar código" />
          {whatsappHref && (
            <a href={whatsappHref} target="_blank" rel="noopener" className="inline-flex h-9 items-center rounded-full px-3.5 text-[13px] text-green hover:underline">
              Enviar comprovante no WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function InstallmentsForm({ projectId }: { projectId: string }) {
  const [state, action] = useActionState(createInstallments, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) form.current?.reset(); }, [state]);
  return (
    <form ref={form} action={action} className="grid gap-4 p-5">
      <input type="hidden" name="project_id" value={projectId} />
      <Field label="Valor total (R$)" htmlFor="in-amount">
        <Input id="in-amount" name="amount" inputMode="decimal" placeholder="12.000,00" required />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Parcelas" htmlFor="in-count">
          <Input id="in-count" name="count" type="number" min={1} max={48} defaultValue={1} />
        </Field>
        <Field label="1º vencimento" htmlFor="in-due">
          <Input id="in-due" name="first_due" type="date" defaultValue={todayISO()} required />
        </Field>
      </div>
      <Field label="Descrição" htmlFor="in-desc" hint="Parcelas mensais. Ex.: “Desenvolvimento” vira “Desenvolvimento 1/3”.">
        <Input id="in-desc" name="description" placeholder="Desenvolvimento" />
      </Field>
      <FormMessage state={state} />
      <div><SubmitButton size="sm" pendingText="Criando…">Criar parcelas</SubmitButton></div>
    </form>
  );
}
