import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { ProjectForm } from "@/components/project-form";
import { getProject } from "@/lib/project-data";

export default async function EditProjectPage({ params }: PageProps<"/projetos/[id]/editar">) {
  const { id } = await params;
  const { project, admin } = await getProject(id);
  if (!admin) redirect(`/projetos/${id}`);
  return (
    <Card className="max-w-3xl p-5 sm:p-7">
      <h2 className="mb-6 font-semibold">Editar projeto</h2>
      <ProjectForm project={project} />
    </Card>
  );
}
