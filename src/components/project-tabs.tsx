"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

export function ProjectTabs({ id, counts }: { id: string; counts: { approvals: number; messages: number; overdue: number } }) {
  const path = usePathname();
  const base = `/projetos/${id}`;
  const tabs = [
    { href: base, label: "Visão geral" },
    { href: `${base}/aprovacoes`, label: "Aprovações", count: counts.approvals, tone: "amber" },
    { href: `${base}/arquivos`, label: "Arquivos" },
    { href: `${base}/mensagens`, label: "Mensagens", count: counts.messages, tone: "green" },
    { href: `${base}/financeiro`, label: "Financeiro", count: counts.overdue, tone: "red" },
  ];
  return (
    <nav aria-label="Seções do projeto" className="-mx-4 mb-8 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {tabs.map((t) => {
          const active = path === t.href;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "relative flex items-center gap-2 px-3.5 py-3 text-sm transition-colors",
                  active ? "text-text" : "text-mute hover:text-soft",
                )}
              >
                {t.label}
                {!!t.count && (
                  <span className={cx("rounded-full px-1.5 font-mono text-[10.5px] tabular",
                    t.tone === "red" ? "bg-red/15 text-red" : t.tone === "green" ? "bg-green/15 text-green" : "bg-amber/15 text-amber")}>
                    {t.count}
                  </span>
                )}
                {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-blue to-green" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
