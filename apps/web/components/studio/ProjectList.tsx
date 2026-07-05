import Link from "next/link";

type ProjectSummary = {
  id: string;
  name: string;
  businessName: string;
  status: string;
  updatedAt: Date;
  _count?: { artifacts: number; sources: number };
};

export function ProjectList({ projects }: { projects: ProjectSummary[] }) {
  return (
    <div className="space-y-2">
      {projects.map((project) => (
        <Link
          className="block rounded-md border border-border bg-card/70 p-3 text-sm transition-colors hover:bg-accent"
          href={`/projects/${project.id}`}
          key={project.id}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{project.name}</span>
            <span className="text-[11px] uppercase text-muted-foreground">
              {project.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {project.businessName}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {project._count?.sources ?? 0} sources ·{" "}
            {project._count?.artifacts ?? 0} artifacts
          </p>
        </Link>
      ))}
    </div>
  );
}
