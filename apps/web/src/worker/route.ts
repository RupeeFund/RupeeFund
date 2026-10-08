type Fetch<E, C> = (request: Request, env: E, ctx: C) => Response | Promise<Response>;

export function route<E, C>(api: Fetch<E, C>, site: Fetch<E, C>): Fetch<E, C> {
  return (request, env, ctx) =>
    new URL(request.url).pathname.startsWith("/api/")
      ? api(request, env, ctx)
      : site(request, env, ctx);
}
