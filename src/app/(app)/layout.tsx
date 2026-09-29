import { Shell, type NavItem } from "@/components/shell";
import { NotificationBell } from "@/components/notification-bell";
import { requireUser } from "@/lib/session";
import type { Notification } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireUser();
  const admin = profile.role === "admin";

  const [{ data: notifications }, pendingApprovals, newRequests, openTickets, waitingLeads] = await Promise.all([
    supabase.from("notifications").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(12),
    admin
      ? Promise.resolve({ count: 0 })
      : supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin
      ? supabase.from("project_requests").select("id", { count: "exact", head: true }).eq("status", "new")
      : Promise.resolve({ count: 0 }),
    admin
      ? supabase.from("tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"])
      : supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "waiting_client"),
    admin
      ? supabase.from("prospect_leads").select("id", { count: "exact", head: true }).in("status", ["interested", "replied"]).not("handoff_at", "is", null).eq("bot_paused", true)
      : Promise.resolve({ count: 0 }),
  ]);

  const nav: NavItem[] = admin
    ? [
        { href: "/admin", label: "Visão geral", icon: "LayoutDashboard" },
        { href: "/admin/clientes", label: "Clientes", icon: "Users" },
        { href: "/projetos", label: "Projetos", icon: "FolderKanban" },
        { href: "/admin/pedidos", label: "Pedidos", icon: "Inbox", badge: newRequests.count ?? 0 },
        { href: "/admin/financeiro", label: "Financeiro", icon: "Wallet" },
        { href: "/admin/prospeccao", label: "Prospecção", icon: "Radar", badge: waitingLeads.count ?? 0 },
        { href: "/suporte", label: "Suporte", icon: "LifeBuoy", badge: openTickets.count ?? 0 },
        { href: "/notificacoes", label: "Notificações", icon: "Bell" },
        { href: "/admin/config", label: "Configurações", icon: "Settings" },
      ]
    : [
        { href: "/painel", label: "Painel", icon: "LayoutDashboard" },
        { href: "/projetos", label: "Meus projetos", icon: "FolderKanban", badge: pendingApprovals.count ?? 0 },
        { href: "/suporte", label: "Suporte", icon: "LifeBuoy", badge: openTickets.count ?? 0 },
        { href: "/novo-projeto", label: "Novo projeto", icon: "Sparkles" },
        { href: "/notificacoes", label: "Notificações", icon: "Bell" },
        { href: "/conta", label: "Minha conta", icon: "UserRound" },
      ];

  return (
    <Shell
      nav={nav}
      name={profile.full_name || profile.email}
      company={profile.company}
      admin={admin}
      bell={<NotificationBell userId={profile.id} initial={(notifications ?? []) as Notification[]} />}
    >
      {children}
    </Shell>
  );
}
