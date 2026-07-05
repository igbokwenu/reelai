import { handleRoute, notFound, ok } from "@/lib/http/responses";
import { getProjectGraph } from "@/lib/projects/graph";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { projectId } = await context.params;
    const project = await getProjectGraph(projectId);

    if (!project) {
      return notFound("Project not found");
    }

    return ok({ project });
  });
}
