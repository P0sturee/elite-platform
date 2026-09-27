import type { Metadata } from "next";
import { Chat } from "@/components/chat";
import { getProject } from "@/lib/project-data";
import type { Message } from "@/lib/types";

export const metadata: Metadata = { title: "Mensagens" };

export default async function MessagesPage({ params }: PageProps<"/projetos/[id]/mensagens">) {
  const { id } = await params;
  const { supabase, profile, project, admin } = await getProject(id);
  const { data } = await supabase.from("messages").select("*").eq("project_id", id).order("created_at").limit(500);

  // Clients can't read team profiles (RLS): for them every other author is shown as "Elite Systems".
  const names: Record<string, string> = {};
  if (admin) {
    const { data: admins } = await supabase.from("profiles").select("id, full_name").eq("role", "admin");
    (admins ?? []).forEach((a) => { names[a.id] = a.full_name || "Equipe"; });
    if (project.profiles) names[project.profiles.id] = project.profiles.full_name || project.profiles.email;
  }

  return <Chat projectId={id} me={profile.id} clientId={project.client_id} initial={(data ?? []) as Message[]} names={names} />;
}
