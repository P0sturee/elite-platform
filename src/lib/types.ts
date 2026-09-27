export type UserRole = "client" | "admin";
export type AccountStatus = "pending" | "active" | "blocked";
export type ProjectStatus = "active" | "paused" | "done" | "cancelled";
export type StageStatus = "pending" | "in_progress" | "done";
export type ApprovalStatus = "pending" | "approved" | "changes_requested";
export type FileCategory = "contrato" | "prototipo" | "entrega" | "manual" | "outro";
export type InstallmentStatus = "pending" | "paid" | "cancelled";
export type TicketStatus = "open" | "in_progress" | "waiting_client" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type RequestStatus = "new" | "in_review" | "converted" | "declined";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  company: string;
  phone: string;
  role: UserRole;
  status: AccountStatus;
  notify_email: boolean;
  notify_whatsapp: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  summary: string;
  kind: string;
  status: ProjectStatus;
  staging_url: string;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Stage {
  id: string;
  project_id: string;
  position: number;
  name: string;
  description: string;
  status: StageStatus;
  progress: number;
  due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface ProjectUpdate {
  id: string;
  project_id: string;
  stage_id: string | null;
  author_id: string | null;
  title: string;
  body: string;
  created_at: string;
}

export interface FileRow {
  id: string;
  project_id: string;
  uploaded_by: string | null;
  name: string;
  storage_path: string;
  size: number;
  mime: string;
  category: FileCategory;
  created_at: string;
}

export interface Approval {
  id: string;
  project_id: string;
  stage_id: string | null;
  file_id: string | null;
  title: string;
  description: string;
  link_url: string;
  status: ApprovalStatus;
  requested_by: string | null;
  created_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string;
}

export interface Message {
  id: string;
  project_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface Installment {
  id: string;
  project_id: string;
  number: number;
  description: string;
  amount_cents: number;
  due_date: string;
  status: InstallmentStatus;
  paid_at: string | null;
  created_at: string;
}

export interface Settings {
  id: number;
  pix_key: string;
  pix_name: string;
  pix_city: string;
  support_whatsapp: string;
}

export interface Ticket {
  id: string;
  number: number;
  client_id: string;
  project_id: string | null;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface ProjectRequest {
  id: string;
  client_id: string;
  types: string[];
  team_size: string;
  priority: string;
  budget: string;
  deadline: string;
  context: string;
  status: RequestStatus;
  project_id: string | null;
  admin_note: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  link: string;
  read_at: string | null;
  created_at: string;
}

export type FormState = { ok?: boolean; error?: string; message?: string } | undefined;
