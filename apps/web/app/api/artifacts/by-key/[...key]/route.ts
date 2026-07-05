import { readLocalObject } from "@/lib/oss";

type RouteContext = {
  params: Promise<{ key: string[] }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { key } = await context.params;
  const objectKey = key.join("/");
  const body = await readLocalObject(objectKey);

  return new Response(body);
}
