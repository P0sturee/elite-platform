"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, SendHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { markProjectRead } from "@/app/actions/projects";
import { date, timeOnly } from "@/lib/format";
import type { Message } from "@/lib/types";
import { Avatar, cx } from "./ui";

export function Chat({
  projectId, me, clientId, initial, names,
}: { projectId: string; me: string; clientId: string; initial: Message[]; names: Record<string, string> }) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    markProjectRead(projectId);
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${projectId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `project_id=eq.${projectId}` }, (payload) => {
        const m = payload.new as Message;
        setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
        if (m.author_id !== me) markProjectRead(projectId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, me]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    const { data, error } = await createClient()
      .from("messages").insert({ project_id: projectId, author_id: me, body }).select().single();
    setSending(false);
    if (error) { setError("A mensagem não foi enviada. Tente de novo."); return; }
    setText("");
    setMessages((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data as Message]));
  }


  return (
    <div className="flex h-[min(70vh,720px)] flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.length === 0 && (
          <p className="mx-auto mt-16 max-w-sm text-center text-sm text-mute">
            Converse com a equipe sobre este projeto. Tudo fica registrado aqui, junto das entregas.
          </p>
        )}
        <ul className="grid gap-3">
          {messages.map((m, i) => {
            const day = date(m.created_at);
            const showDay = i === 0 || date(messages[i - 1]!.created_at) !== day;
            const mine = m.author_id === me;
            const fromTeam = m.author_id !== clientId;
            const name = mine ? "Você" : names[m.author_id] ?? (fromTeam ? "Elite Systems" : "Cliente");
            return (
              <li key={m.id}>
                {showDay && <p className="my-3 text-center font-mono text-[10.5px] uppercase tracking-widest text-mute">{day}</p>}
                <div className={cx("flex items-end gap-2.5", mine && "flex-row-reverse")}>
                  {!mine && <Avatar name={name} size={30} admin={fromTeam} />}
                  <div className={cx("max-w-[80%] rounded-2xl px-4 py-2.5",
                    mine ? "rounded-br-md bg-blue text-white" : "rounded-bl-md border border-line bg-surface-2")}>
                    {!mine && <p className="mb-0.5 text-xs font-semibold text-blue-2">{name}</p>}
                    <p className="whitespace-pre-wrap break-words text-[14.5px] leading-relaxed">{m.body}</p>
                    <p className={cx("mt-1 text-right font-mono text-[10px]", mine ? "text-white/70" : "text-mute")}>{timeOnly(m.created_at)}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div ref={bottom} />
      </div>
      <form
        className="border-t border-line p-3 sm:p-4"
        onSubmit={(e) => { e.preventDefault(); send(); }}
      >
        {error && <p role="alert" className="mb-2 text-sm text-red">{error}</p>}
        <div className="flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">Mensagem</label>
          <textarea
            id="chat-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            maxLength={5000}
            placeholder="Escreva uma mensagem…  (Shift+Enter quebra a linha)"
            className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-line-2 bg-surface-2/70 px-3.5 py-2.5 text-[15px] placeholder:text-mute focus:border-blue focus:outline-none focus:ring-3 focus:ring-blue/25"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue text-white transition-colors hover:bg-[#3f78ff] disabled:opacity-40"
            aria-label="Enviar mensagem"
          >
            {sending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <SendHorizontal className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </form>
    </div>
  );
}
