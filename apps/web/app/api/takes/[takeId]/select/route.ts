import { handleRoute, ok } from "@/lib/http/responses";
import { assertManualTakeControlAvailable } from "@/lib/jobs/manual-control";
import { selectTake } from "@/lib/jobs/production";

type RouteContext = {
  params: Promise<{ takeId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { takeId } = await context.params;
    await assertManualTakeControlAvailable(takeId);
    const take = await selectTake(takeId);

    return ok({ take });
  });
}
