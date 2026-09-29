import Link from "next/link";
import type { Metadata } from "next";
import type { ComponentProps } from "react";
import { Bot, CircleAlert, MapPin, Radar, ShieldCheck } from "lucide-react";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, PageHeader, Stat, cx } from "@/components/ui";
import {
  ProspectKeyForm, ProspectSettingsForm, ProspectToggle, RunSearchButton, SearchAddForm,
} from "@/components/prospect-forms";
import { updateSearch } from "@/app/actions/prospect";
import { deliveryStatus } from "@/app/actions/delivery";
import { requireAdmin } from "@/lib/session";
import { leadStatus, prospectDailyLimit } from "@/lib/labels";
import { dateTime, isPast, relative, timeOnly, todayISO } from "@/lib/format";
import type { LeadStatus, ProspectLead, ProspectSearch, ProspectSettings } from "@/lib/types";

export const metadata: Metadata = { title: "Prospecção" };

const TABS = { leads: "Leads", buscas: "Buscas", ajustes: "Ajustes" } as const;
const FILTERS: { key: string; label: string; statuses?: LeadStatus[] }[] = [
  { key: "ativos", label: "Em conversa", statuses: ["contacted", "replied", "interested"] },
  { key: "fila", label: "Na fila", statuses: ["new"] },
  { key: "reunioes", label: "Reuniões", statuses: ["meeting"] },
  { key: "encerrados", label: "Encerrados", statuses: ["not_interested", "opted_out", "no_whatsapp", "error"] },
  { key: "todos", label: "Todos" },
];

export default async function ProspectingPage({ searchParams }: PageProps<"/admin/prospeccao">) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const tab = (Object.keys(TABS) as (keyof typeof TABS)[]).find((t) => t === sp.aba) ?? "leads";
  const filter = FILTERS.find((f) => f.key === sp.status) ?? FILTERS[0]!;
  const today = todayISO();
  const head = { count: "exact" as const, head: true };

  let leadsQuery = supabase.from("prospect_leads").select("*").order("updated_at", { ascending: false }).limit(100);
  if (filter.statuses) leadsQuery = leadsQuery.in("status", filter.statuses);

  const [{ data: s }, { data: keys }, wa, sentToday, queued, replied, interested, meetings, { data: handoffs }, { data: leads }, { data: searches }] =
    await Promise.all([
      supabase.from("prospect_settings").select("*").eq("id", 1).single<ProspectSettings>(),
      supabase.rpc("prospect_integrations"),
      deliveryStatus(),
      supabase.from("prospect_leads").select("id", head).gte("contacted_at", `${today}T00:00:00-03:00`),
      supabase.from("prospect_leads").select("id", head).eq("status", "new"),
      supabase.from("prospect_leads").select("id", head).in("status", ["replied", "interested", "meeting", "not_interested"]),
      supabase.from("prospect_leads").select("id", head).eq("status", "interested"),
      supabase.from("prospect_leads").select("id", head).eq("status", "meeting"),
      supabase.from("prospect_leads").select("*").not("handoff_at", "is", null).in("status", ["interested", "replied"]).eq("bot_paused", true)
        .order("handoff_at", { ascending: false }).limit(20),
      tab === "leads" ? leadsQuery : Promise.resolve({ data: [] }),
      tab === "buscas" ? supabase.from("prospect_searches").select("*").order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    ]);
  const settings = s!;
  const { day, limit } = prospectDailyLimit(settings.warmup_started, today, settings.daily_max);
  const waOpen = wa.whatsapp?.state === "open";
  const problems = [
    !waOpen && "O WhatsApp da Elite não está conectado (Configurações → Avisos).",
    !keys?.google && "Falta a chave do Google Places (Ajustes).",
    !keys?.anthropic && "Falta a chave da Anthropic para a IA responder (Ajustes).",
  ].filter(Boolean) as string[];

  return (
    <>
      <PageHeader eyebrow="Painel da equipe" title="Prospecção"
        description="O robô busca empresas no Google Maps, oferece o OrçaPro pelo WhatsApp e te chama quando alguém quer uma apresentação." />

      <Card className="mb-6 grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex items-start gap-4">
          <span className={cx("grid size-12 shrink-0 place-items-center rounded-2xl", settings.enabled ? "bg-green/12 text-green" : "bg-white/5 text-mute")}>
            <Bot className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              Robô {settings.enabled ? <Badge tone="green" dot>Ligado</Badge> : <Badge tone="mute" dot>Pausado</Badge>}
            </p>
            <p className="mt-1 text-sm text-soft">
              {settings.enabled
                ? `Envia de ${settings.window_start}h às ${settings.window_end}h${settings.weekdays_only ? ", de segunda a sexta" : ""}.` +
                  (settings.next_send_at && !isPast(settings.next_send_at) ? ` Próximo envio por volta das ${timeOnly(settings.next_send_at)}.` : "")
                : settings.paused_reason || "Ligue quando as chaves e as buscas estiverem prontas."}
            </p>
            {problems.length > 0 && (
              <ul className="mt-3 grid gap-1.5">
                {problems.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-amber"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{p}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <ProspectToggle enabled={settings.enabled} />
      </Card>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Enviadas hoje" value={`${sentToday.count ?? 0}/${limit}`} hint={settings.warmup_started ? (day <= 6 ? `1ª semana: dia ${day}` : "Ritmo cheio") : "Começa no 1º envio"} />
        <Stat label="Na fila" value={queued.count ?? 0} hint="Empresas com celular" />
        <Stat label="Responderam" value={replied.count ?? 0} />
        <Stat label="Querem apresentação" value={interested.count ?? 0} tone="green" hint={interested.count ? "Esperando você" : undefined} />
        <Stat label="Reuniões marcadas" value={meetings.count ?? 0} />
      </div>

      {(handoffs ?? []).length > 0 && (
        <Card className="mb-8 border-green/30">
          <CardHeader eyebrow="O robô passou para você" title="Precisam de você" />
          <ul className="divide-y divide-line">
            {(handoffs as ProspectLead[]).map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {l.name} <Badge tone={leadStatus[l.status].tone} dot>{l.status === "replied" ? "Pediu atenção" : leadStatus[l.status].label}</Badge>
                  </p>
                  <p className="text-sm text-soft">{l.summary || "Abra a conversa para ver o que ele disse."}</p>
                  <p className="text-xs text-mute">{l.handoff_at && relative(l.handoff_at)}{l.category && ` · ${l.category}`}</p>
                </div>
                <ButtonLink href={`/admin/prospeccao/${l.id}`} size="sm">Abrir conversa</ButtonLink>
                <a href={`https://wa.me/${l.phone}`} target="_blank" rel="noopener" className="text-sm text-green hover:underline">WhatsApp</a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <nav aria-label="Seções" className="mb-6 flex gap-2 border-b border-line">
        {(Object.entries(TABS) as [keyof typeof TABS, string][]).map(([k, label]) => (
          <Link key={k} href={k === "leads" ? "/admin/prospeccao" : `/admin/prospeccao?aba=${k}`} aria-current={tab === k ? "page" : undefined}
            className={cx("-mb-px border-b-2 px-3 pb-3 text-sm", tab === k ? "border-blue text-text" : "border-transparent text-soft hover:text-text")}>
            {label}
          </Link>
        ))}
      </nav>

      {tab === "leads" && (
        <>
          <nav aria-label="Filtrar leads" className="mb-4 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Link key={f.key} href={f.key === "ativos" ? "/admin/prospeccao" : `/admin/prospeccao?status=${f.key}`} aria-current={filter.key === f.key ? "page" : undefined}
                className={cx("rounded-full px-3.5 py-1.5 text-sm ring-1 ring-inset", filter.key === f.key ? "bg-blue/15 ring-blue/40" : "text-soft ring-line hover:text-text")}>
                {f.label}
              </Link>
            ))}
          </nav>
          <Card>
            {(leads ?? []).length === 0 ? (
              <EmptyState icon={<Radar className="size-5" />} title="Nenhum lead aqui">
                Adicione buscas (segmento + cidade) e ligue o robô: as empresas com celular entram na fila automaticamente.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {(leads as ProspectLead[]).map((l) => (
                  <li key={l.id}>
                    <Link href={`/admin/prospeccao/${l.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-surface-2/50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{l.name}</p>
                        <p className="truncate text-xs text-mute">{[l.category, l.address].filter(Boolean).join(" · ")}</p>
                        {l.summary && <p className="mt-0.5 truncate text-sm text-soft">{l.summary}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        {l.bot_paused && l.status !== "new" && <Badge tone="blue">Com você</Badge>}
                        <Badge tone={leadStatus[l.status].tone} dot>{leadStatus[l.status].label}</Badge>
                        <span className="w-24 text-right font-mono text-[11px] text-mute">{relative(l.last_inbound_at ?? l.contacted_at ?? l.created_at)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {tab === "buscas" && (
        <div className="grid gap-6">
          <Card>
            <CardHeader eyebrow="Google Maps" title="Novas buscas" />
            <SearchAddForm />
          </Card>
          <Card>
            <CardHeader title="Buscas" eyebrow="O robô percorre uma por vez, até 60 empresas cada" />
            {(searches ?? []).length === 0 ? (
              <EmptyState icon={<MapPin className="size-5" />} title="Nenhuma busca ainda">Ex.: “eletricista” + “Curitiba”.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {(searches as ProspectSearch[]).map((q) => (
                  <li key={q.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{q.query}</p>
                      <p className="text-xs text-mute">
                        {q.found} com celular na fila · {q.last_run_at ? `última busca ${dateTime(q.last_run_at)}` : "ainda não buscada"}
                      </p>
                      {q.last_error && <p className="text-xs text-red">{q.last_error}</p>}
                    </div>
                    {q.exhausted ? <Badge tone="mute">Concluída</Badge> : q.active ? <Badge tone="green" dot>Ativa</Badge> : <Badge tone="amber">Pausada</Badge>}
                    {!q.exhausted && <RunSearchButton id={q.id} />}
                    <form action={updateSearch} className="flex gap-1">
                      <input type="hidden" name="id" value={q.id} />
                      {q.exhausted
                        ? <SmallButton name="op" value="restart">Buscar de novo</SmallButton>
                        : <SmallButton name="op" value={q.active ? "deactivate" : "activate"}>{q.active ? "Pausar" : "Ativar"}</SmallButton>}
                      <SmallButton name="op" value="delete" danger>Remover</SmallButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "ajustes" && (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card>
            <CardHeader eyebrow="Mensagens e ritmo" title="Ajustes do robô" />
            <ProspectSettingsForm settings={settings} />
          </Card>
          <div className="grid h-fit gap-8">
            <Card>
              <CardHeader eyebrow="Guardadas no cofre (Vault)" title="Chaves" />
              <div className="grid gap-6 p-5">
                <ProspectKeyForm name="google_places_key" label="Google Places" configured={!!keys?.google}
                  hint={<>Google Cloud → APIs → ative <b>Places API (New)</b> → Credenciais → Criar chave. Restrinja a chave a essa API.</>} />
                <ProspectKeyForm name="anthropic_api_key" label="Anthropic (IA)" configured={!!keys?.anthropic}
                  hint={<>console.anthropic.com → API Keys. A IA usa o Claude Opus 5.5 para entender e responder.</>} />
              </div>
            </Card>
            <Card>
              <CardHeader eyebrow="Para não perder o número" title="Proteções ativas" />
              <ul className="grid gap-2.5 p-5 text-sm text-soft">
                {[
                  `Número já aquecido: 25 por dia nos 2 primeiros dias de prospecção, 35 até o 6º e depois o seu limite (${settings.daily_max}).`,
                  "Envios espalhados pelo horário comercial, com intervalo aleatório e “digitando…”.",
                  "Só celulares, conferidos no WhatsApp antes do envio; nunca clientes da plataforma.",
                  "Uma única mensagem por empresa, sem insistir; quem responde SAIR não recebe mais nada.",
                  "Pausa sozinho se o WhatsApp cair ou se 3 envios seguidos falharem.",
                  "Se você responder a conversa pelo celular, o robô para de responder aquele lead.",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-green" aria-hidden="true" />{t}</li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

function SmallButton({ children, danger, ...props }: ComponentProps<"button"> & { danger?: boolean }) {
  return (
    <button {...props} className={cx("h-8 rounded-full px-3 text-xs ring-1 ring-inset", danger ? "text-red ring-red/30 hover:bg-red/10" : "text-soft ring-line-2 hover:text-text")}>
      {children}
    </button>
  );
}
