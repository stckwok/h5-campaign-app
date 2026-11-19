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

    // 1. Write funnel analytics event to D1 (Public endpoint)
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

    // 2. Read aggregated funnel metrics (Protected by STATS_KEY)
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

      const { results: eventStats } = await env.DB.prepare(
        'SELECT event, COUNT(*) as count FROM events GROUP BY event ORDER BY count DESC'
      ).all<{ event: string; count: number }>();

      const { results: countryStats } = await env.DB.prepare(
        'SELECT country, COUNT(*) as count FROM events GROUP BY country ORDER BY count DESC LIMIT 10'
      ).all<{ country: string; count: number }>();

      // Return HTML Dashboard if ?format=html is requested
      if (url.searchParams.get('format') === 'html') {
        const countMap = Object.fromEntries(eventStats.map((r) => [r.event, r.count]));
        const loaded = countMap['campaign_loaded'] || 0;
        const uploaded = countMap['photo_uploaded'] || 0;
        const exported = countMap['poster_exported'] || 0;
        const exportRate = loaded > 0 ? ((exported / loaded) * 100).toFixed(1) : '0.0';

        const eventRows = eventStats
          .map(
            (r) =>
              `<tr><td><code>${r.event}</code></td><td><strong>${r.count}</strong></td></tr>`
          )
          .join('');

        const countryRows = countryStats
          .map(
            (r) =>
              `<tr><td>${r.country || 'Unknown'}</td><td><strong>${r.count}</strong></td></tr>`
          )
          .join('');

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>H5 Campaign Funnel Stats</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #121216; color: #f4f4f6; margin: 0; padding: 24px; }
    .container { max-width: 720px; margin: 0 auto; }
    h1 { font-size: 22px; margin-bottom: 20px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 28px; }
    .card { background: #1e1e26; padding: 16px; border-radius: 12px; border: 1px solid #2e2e3a; }
    .card span { font-size: 12px; color: #9a9aa8; display: block; margin-bottom: 6px; }
    .card strong { font-size: 24px; color: #ff6a00; }
    table { width: 100%; border-collapse: collapse; background: #1e1e26; border-radius: 12px; overflow: hidden; margin-bottom: 24px; }
    th, td { text-align: left; padding: 12px 16px; border-bottom: 1px solid #2e2e3a; }
    th { background: #262630; font-size: 13px; color: #a0a0b0; }
    code { background: #2c2c38; padding: 3px 6px; border-radius: 4px; color: #00f2fe; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 H5 Campaign Funnel Analytics</h1>
    <div class="cards">
      <div class="card"><span>Campaign Loads</span><strong>${loaded}</strong></div>
      <div class="card"><span>Photos Uploaded</span><strong>${uploaded}</strong></div>
      <div class="card"><span>Posters Exported</span><strong>${exported}</strong></div>
      <div class="card"><span>Load → Export Rate</span><strong>${exportRate}%</strong></div>
    </div>
    <h2>Funnel Events</h2>
    <table><thead><tr><th>Event Name</th><th>Count</th></tr></thead><tbody>${eventRows || '<tr><td colspan="2">No events recorded yet</td></tr>'}</tbody></table>
    <h2>Top Countries</h2>
    <table><thead><tr><th>Country</th><th>Events</th></tr></thead><tbody>${countryRows || '<tr><td colspan="2">No data yet</td></tr>'}</tbody></table>
  </div>
</body>
</html>`;

        return new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      return new Response(JSON.stringify({ stats: eventStats, countries: countryStats }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Serve static Vue SPA files for all other routes
    return env.ASSETS.fetch(request);
  },
};
