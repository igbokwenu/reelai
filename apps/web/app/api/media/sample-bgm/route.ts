/**
 * Backward-compatible preview URL for older clients. New UI code reads the
 * curated catalog assets directly.
 */
export function GET(request: Request) {
  return Response.redirect(
    new URL("/audio/bgm/warm-uplift.mp3", request.url),
    307,
  );
}
