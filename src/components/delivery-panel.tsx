"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2, Mail, MessageCircle, QrCode } from "lucide-react";
import {
  deliveryStatus, emailTest, whatsappConnect, whatsappLogout, whatsappTest, type DeliveryStatus,
} from "@/app/actions/delivery";
import { Badge, Button } from "./ui";

const stateLabel: Record<string, { label: string; tone: "green" | "amber" | "red" | "mute" }> = {
  open: { label: "Conectado", tone: "green" },
  connecting: { label: "Aguardando leitura do QR", tone: "amber" },
  close: { label: "Desconectado", tone: "red" },
  missing: { label: "Não conectado", tone: "mute" },
  not_configured: { label: "Não configurado", tone: "mute" },
  error: { label: "Servidor indisponível", tone: "red" },
};

function formatPhone(n?: string) {
  if (!n) return "";
  const d = n.replace(/\D/g, "").replace(/^55/, "");
  return d.length === 11 ? `+55 (${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `+${n}`;
}

export function DeliveryPanel({ initial }: { initial: DeliveryStatus }) {
  const [status, setStatus] = useState(initial);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const wa = status.whatsapp?.state ?? "missing";
  const st = stateLabel[wa] ?? { label: wa, tone: "mute" as const };

  // While the QR is on screen: poll the connection every 3 s and refresh the QR every 30 s.
  useEffect(() => {
    if (!qr) return;
    const poll = setInterval(async () => {
      const s = await deliveryStatus();
      setStatus(s);
      if (s.whatsapp?.state === "open") {
        setQr(null);
        setNote({ text: "WhatsApp conectado! Os avisos já saem por ele.", ok: true });
      }
    }, 3000);
    const refresh = setInterval(async () => {
      const r = await whatsappConnect();
      if (r.qr) setQr(r.qr);
    }, 30000);
    return () => { clearInterval(poll); clearInterval(refresh); };
  }, [qr]);

  async function run(key: string, fn: () => Promise<{ error?: string; result?: string }>, okText: string) {
    setBusy(key);
    setNote(null);
    const r = await fn();
    setBusy(null);
    if (r.error) setNote({ text: r.error, ok: false });
    else if (r.result && r.result !== "sent") setNote({ text: `Falhou: ${r.result}`, ok: false });
    else setNote({ text: okText, ok: true });
  }

  async function connect() {
    setBusy("connect");
    setNote(null);
    const r = await whatsappConnect();
    setBusy(null);
    if (r.error) return setNote({ text: r.error, ok: false });
    if (r.state === "open") return setStatus(await deliveryStatus());
    if (r.qr) setQr(r.qr);
    else setNote({ text: "Não recebemos o QR Code. Tente de novo em alguns segundos.", ok: false });
  }

  return (
    <div className="grid gap-5 p-5">
      <div className="flex items-start gap-3">
        <Mail className="mt-0.5 size-5 shrink-0 text-blue-2" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            E-mail {status.email?.configured ? <Badge tone="green" dot>Ativo</Badge> : <Badge tone="amber" dot>Sem chave</Badge>}
          </p>
          <p className="truncate text-xs text-mute">{status.email?.from || "Resend não configurado"}</p>
        </div>
        <Button size="sm" variant="ghost" disabled={!!busy || !status.email?.configured}
          onClick={() => run("mail", emailTest, "E-mail de teste enviado para o seu endereço.")}>
          {busy === "mail" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Testar
        </Button>
      </div>

      <div className="flex items-start gap-3 border-t border-line pt-5">
        <MessageCircle className="mt-0.5 size-5 shrink-0 text-green" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">WhatsApp <Badge tone={st.tone} dot>{st.label}</Badge></p>
          <p className="text-xs text-mute">
            {wa === "open"
              ? `${formatPhone(status.whatsapp?.number)}${status.whatsapp?.profileName ? ` · ${status.whatsapp.profileName}` : ""}`
              : "Conecte o número que vai enviar os avisos (Evolution API)."}
          </p>
        </div>
      </div>

      {qr && (
        <div className="grid gap-3 rounded-2xl border border-line-2 bg-bg/50 p-4 sm:grid-cols-[200px_minmax(0,1fr)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- base64 QR from the Evolution API */}
          <img src={qr} alt="QR Code para conectar o WhatsApp" className="w-full max-w-[200px] rounded-xl bg-white p-2" />
          <div className="text-sm text-soft">
            <p className="flex items-center gap-2 font-medium text-text"><QrCode className="size-4" aria-hidden="true" /> Escaneie com o WhatsApp</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-mute">
              <li>No celular, abra o WhatsApp do número da empresa.</li>
              <li>Toque em ⋮ ou Configurações → Aparelhos conectados.</li>
              <li>Toque em Conectar um aparelho e aponte para este código.</li>
            </ol>
            <p className="mt-3 flex items-center gap-2 text-xs text-amber"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Aguardando a leitura… o código se renova sozinho.</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {wa !== "open" && !qr && (
          <Button size="sm" onClick={connect} disabled={!!busy || wa === "not_configured"}>
            {busy === "connect" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Conectar WhatsApp
          </Button>
        )}
        {wa === "open" && (
          <>
            <Button size="sm" variant="ghost" disabled={!!busy}
              onClick={() => run("wa", whatsappTest, "Mensagem de teste enviada para o seu WhatsApp (Minha conta).")}>
              {busy === "wa" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Enviar teste
            </Button>
            <Button size="sm" variant="danger" disabled={!!busy}
              onClick={async () => { setBusy("logout"); await whatsappLogout(); setStatus(await deliveryStatus()); setBusy(null); }}>
              Desconectar
            </Button>
          </>
        )}
      </div>

      {note && (
        <p role="status" className={`flex items-start gap-2 text-sm ${note.ok ? "text-green" : "text-red"}`}>
          {note.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
          {note.text}
        </p>
      )}
    </div>
  );
}
