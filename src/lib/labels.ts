import type {
  AccountStatus, ApprovalStatus, FileCategory, InstallmentStatus, LeadStatus, ProjectStatus,
  RequestStatus, StageStatus, TicketPriority, TicketStatus,
} from "./types";

export type Tone = "blue" | "green" | "red" | "amber" | "mute";

export const projectStatus: Record<ProjectStatus, { label: string; tone: Tone }> = {
  active: { label: "Em andamento", tone: "blue" },
  paused: { label: "Pausado", tone: "amber" },
  done: { label: "Concluído", tone: "green" },
  cancelled: { label: "Cancelado", tone: "mute" },
};

export const stageStatus: Record<StageStatus, { label: string; tone: Tone }> = {
  pending: { label: "A fazer", tone: "mute" },
  in_progress: { label: "Em andamento", tone: "blue" },
  done: { label: "Concluída", tone: "green" },
};

export const approvalStatus: Record<ApprovalStatus, { label: string; tone: Tone }> = {
  pending: { label: "Aguardando você", tone: "amber" },
  approved: { label: "Aprovado", tone: "green" },
  changes_requested: { label: "Ajustes pedidos", tone: "red" },
};

export const fileCategory: Record<FileCategory, string> = {
  contrato: "Contrato",
  prototipo: "Protótipo",
  entrega: "Entrega",
  manual: "Manual",
  outro: "Outro",
};

export const installmentStatus: Record<InstallmentStatus | "overdue", { label: string; tone: Tone }> = {
  pending: { label: "A vencer", tone: "blue" },
  overdue: { label: "Vencida", tone: "red" },
  paid: { label: "Paga", tone: "green" },
  cancelled: { label: "Cancelada", tone: "mute" },
};

export const ticketStatus: Record<TicketStatus, { label: string; tone: Tone }> = {
  open: { label: "Aberto", tone: "amber" },
  in_progress: { label: "Em atendimento", tone: "blue" },
  waiting_client: { label: "Aguardando você", tone: "amber" },
  resolved: { label: "Resolvido", tone: "green" },
  closed: { label: "Fechado", tone: "mute" },
};

// Response targets shown to the client, in hours.
export const ticketPriority: Record<TicketPriority, { label: string; tone: Tone; slaHours: number }> = {
  low: { label: "Baixa", tone: "mute", slaHours: 48 },
  normal: { label: "Normal", tone: "blue", slaHours: 24 },
  high: { label: "Alta", tone: "amber", slaHours: 8 },
  urgent: { label: "Urgente", tone: "red", slaHours: 4 },
};

export const requestStatus: Record<RequestStatus, { label: string; tone: Tone }> = {
  new: { label: "Novo", tone: "amber" },
  in_review: { label: "Em análise", tone: "blue" },
  converted: { label: "Virou projeto", tone: "green" },
  declined: { label: "Recusado", tone: "mute" },
};

export const accountStatus: Record<AccountStatus, { label: string; tone: Tone }> = {
  pending: { label: "Aguardando aprovação", tone: "amber" },
  active: { label: "Ativa", tone: "green" },
  blocked: { label: "Bloqueada", tone: "red" },
};

export const SYSTEM_TYPES = [
  "Gestão (ERP)",
  "SaaS",
  "Automação & WhatsApp",
  "Dashboards & BI",
  "App mobile",
  "Site / landing page",
];
export const TEAM_SIZES = ["1–5", "6–20", "21–100", "100+"];
export const PRIORITIES = ["Organizar o financeiro", "Vender mais", "Reduzir trabalho manual", "Lançar um produto"];
export const BUDGETS = ["Até R$ 5 mil", "R$ 5–15 mil", "R$ 15–40 mil", "Acima de R$ 40 mil", "Ainda não sei"];
export const DEADLINES = ["Até 1 mês", "1 a 3 meses", "3 a 6 meses", "Sem pressa"];

export const leadStatus: Record<LeadStatus, { label: string; tone: Tone }> = {
  new: { label: "Na fila", tone: "mute" },
  contacted: { label: "Contatado", tone: "blue" },
  replied: { label: "Respondeu", tone: "amber" },
  interested: { label: "Quer apresentação", tone: "green" },
  meeting: { label: "Reunião marcada", tone: "green" },
  not_interested: { label: "Sem interesse", tone: "mute" },
  opted_out: { label: "Pediu para sair", tone: "red" },
  no_whatsapp: { label: "Sem WhatsApp", tone: "mute" },
  error: { label: "Falha no envio", tone: "red" },
};

/** Messages per day while the number warms up (days since the first send), capped by the admin's limit. */
export function prospectDailyLimit(warmupStarted: string | null, today: string, dailyMax: number) {
  const day = warmupStarted ? Math.floor((Date.parse(today) - Date.parse(warmupStarted)) / 86_400_000) : 0;
  const ramp = day < 3 ? 8 : day < 7 ? 12 : day < 14 ? 20 : day < 21 ? 30 : 60;
  return { day: day + 1, limit: Math.min(ramp, dailyMax) };
}
