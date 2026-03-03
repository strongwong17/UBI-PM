import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ProjectForm } from "@/components/projects/project-form";

export default async function NewProjectPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const users = await prisma.user.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <ProjectForm users={users} />
    </div>
  );
}
