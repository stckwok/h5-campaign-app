interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  run(): Promise<any>;
  all<T = Record<string, any>>(): Promise<{ results: T[] }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
  DB?: D1Database;
  STATS_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1. Write funnel analytics event to D1 (Public endpoint for H5 clients)
    if (request.method === 'POST' && url.pathname === '/api/analytics/track') {
      try {
        const body = (await request.json()) as {
          event?: string;
          props?: Record<string, any>;
        };

        const eventName = body.event || 'unknown';
        const country = (request as any).cf?.country || 'unknown';
        const city = (request as any).cf?.city || 'unknown';
        const propsJson = JSON.stringify(body.props || {});
        const now = Date.now();

        if (env.DB) {
          await env.DB.prepare(
            'INSERT INTO events (event, country, city, props, created_at) VALUES (?, ?, ?, ?, ?)'
          )
            .bind(eventName, country, city, propsJson, now)
            .run();
        }

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

    // 2. Read aggregated funnel counts (Protected by STATS_KEY)
    if (request.method === 'GET' && url.pathname === '/api/analytics/stats') {
      const providedKey =
        url.searchParams.get('key') || request.headers.get('X-Stats-Key');

      if (!env.STATS_KEY || providedKey !== env.STATS_KEY) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!env.DB) {
        return new Response(JSON.stringify({ error: 'DB not bound' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const { results } = await env.DB.prepare(
        'SELECT event, COUNT(*) as count FROM events GROUP BY event ORDER BY count DESC'
      ).all();

      return new Response(JSON.stringify({ stats: results }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Serve static Vue SPA files for all other routes
    return env.ASSETS.fetch(request);
  },
};
