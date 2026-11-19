interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle POST funnel analytics events
    if (request.method === 'POST' && url.pathname === '/api/analytics/track') {
      try {
        const body = (await request.json()) as {
          event?: string;
          props?: Record<string, any>;
        };

        // Structured log visible in Cloudflare Dashboard -> Workers -> Logs
        console.log(
          JSON.stringify({
            type: 'FUNNEL_EVENT',
            event: body.event || 'unknown',
            country: (request as any).cf?.country || 'unknown',
            city: (request as any).cf?.city || 'unknown',
            props: body.props || {},
          })
        );

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({ ok: false }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Serve static Vue SPA files for all other routes
    return env.ASSETS.fetch(request);
  },
};
