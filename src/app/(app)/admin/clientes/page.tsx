import Link from "next/link";
import type { Metadata } from "next";
import { Users } from "lucide-react";
import { Avatar, Badge, ButtonLink, Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { setClientStatus } from "@/app/actions/account";
import { requireAdmin } from "@/lib/session";
import { accountStatus } from "@/lib/labels";
import { date, waNumber } from "@/lib/format";
import type { AccountStatus, Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Clientes" };

type Row = Profile & { projects: { count: number }[] };

function StatusAction({ id, status, label, tone }: { id: string; status: AccountStatus; label: string; tone: "green" | "red" | "mute" }) {
  return (
    <form action={setClientStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={cx("h-8 rounded-full px-3 text-xs ring-1 ring-inset",
        tone === "green" ? "bg-green text-bg ring-green" : tone === "red" ? "text-red ring-red/30 hover:bg-red/10" : "text-soft ring-line hover:text-text")}>
        {label}
      </button>
    </form>
  );
}

export default async function ClientsPage({ searchParams }: PageProps<"/admin/clientes">) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const filter = (typeof sp.status === "string" ? sp.status : "todos") as AccountStatus | "todos";
  const only = typeof sp.c === "string" ? sp.c : null;

  let query = supabase.from("profiles").select("*, projects(count)").eq("role", "client").order("created_at", { ascending: false });
  if (only) query = query.eq("id", only);
  else if (filter !== "todos") query = query.eq("status", filter);
  const { data } = await query;
  const clients = (data ?? []) as Row[];

  return (
    <>
      <PageHeader
        eyebrow="Painel da equipe"
        title="Clientes"
        description="Aprove novos cadastros e vincule projetos. Contas aguardando aprovação só conseguem enviar briefings."
      />
      <nav aria-label="Filtrar clientes" className="mb-6 flex flex-wrap gap-2">
        {(["todos", "pending", "active", "blocked"] as const).map((f) => (
          <Link key={f} href={f === "todos" ? "/admin/clientes" : `/admin/clientes?status=${f}`} aria-current={!only && filter === f ? "page" : undefined}
            className={cx("rounded-full px-3.5 py-1.5 text-sm ring-1 ring-inset", !only && filter === f ? "bg-blue/15 ring-blue/40" : "text-soft ring-line hover:text-text")}>
            {f === "todos" ? "Todos" : accountStatus[f].label}
          </Link>
        ))}
      </nav>
      <Card>
        {clients.length ? (
          <ul className="divide-y divide-line">
            {clients.map((c) => {
              const st = accountStatus[c.status];
              const projects = c.projects[0]?.count ?? 0;
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <Avatar name={c.full_name || c.email} />
                  <div className="min-w-0 flex-1 basis-60">
                    <p className="truncate font-medium">{c.full_name || "Sem nome"} {c.company && <span className="text-mute">· {c.company}</span>}</p>
                    <p className="truncate text-xs text-mute">
                      {c.email}
                      {c.phone && <> · <a href={`https://wa.me/${waNumber(c.phone)}`} target="_blank" rel="noopener" className="text-green hover:underline">WhatsApp</a></>}
                      {" · desde "}{date(c.created_at)}
                    </p>
                  </div>
                  <Link href={`/projetos?cliente=${c.id}`} className="font-mono text-xs text-mute hover:text-text tabular">
                    {projects} {projects === 1 ? "projeto" : "projetos"}
                  </Link>
                  <Badge tone={st.tone} dot>{st.label}</Badge>
                  <div className="flex flex-wrap gap-1.5">
                    {c.status === "pending" && <StatusAction id={c.id} status="active" label="Aprovar" tone="green" />}
                    {c.status === "active" && <StatusAction id={c.id} status="blocked" label="Bloquear" tone="red" />}
                    {c.status === "blocked" && <StatusAction id={c.id} status="active" label="Desbloquear" tone="mute" />}
                    <ButtonLink href={`/projetos/novo?cliente=${c.id}`} variant="ghost" size="sm">Criar projeto</ButtonLink>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<Users className="size-5" />} title="Nenhum cliente aqui">
            Quando alguém criar conta na plataforma, aparece nesta lista para você aprovar.
          </EmptyState>
        )}
      </Card>
    </>
  );
}
