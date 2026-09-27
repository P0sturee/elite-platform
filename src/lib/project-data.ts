import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "./session";
import type { Profile, Project, Stage } from "./types";

export type ProjectDetail = Project & {
  project_stages: Stage[];
  profiles: Pick<Profile, "id" | "full_name" | "company" | "email" | "phone"> | null;
};

/** Loads a project the current user can see (RLS decides), shared by the layout and its tabs. */
export const getProject = cache(async (id: string) => {
  const session = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await session.supabase
    .from("projects")
    .select("*, project_stages(*), profiles(id, full_name, company, email, phone)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const project = data as ProjectDetail;
  project.project_stages.sort((a, b) => a.position - b.position);
  return { ...session, project, admin: session.profile.role === "admin" };
});
