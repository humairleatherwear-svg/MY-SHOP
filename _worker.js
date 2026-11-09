async function same(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const p = new Uint8Array(x), q = new Uint8Array(y);
  let d = 0;
  for (let i = 0; i < p.length; i++) d |= p[i] ^ q[i];
  return d === 0;
}
const J = { "content-type": "application/json", "cache-control": "no-store" };
const out = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: J });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/data") {
      if (!env.SHOP) return out({ error: "KV binding SHOP missing" }, 500);
      if (request.method === "GET") {
        const v = await env.SHOP.get("site");
        return new Response(v || "null", { headers: J });
      }
      if (request.method === "PUT") {
        const pw = request.headers.get("x-admin-password") || "";
        if (!env.ADMIN_PASSWORD || !(await same(pw, env.ADMIN_PASSWORD))) {
          await new Promise((r) => setTimeout(r, 800));
          return out({ error: "unauthorized" }, 401);
        }
        const body = await request.text();
        if (body.length > 20 * 1024 * 1024) return out({ error: "too large" }, 413);
        let d;
        try { d = JSON.parse(body); } catch { return out({ error: "bad json" }, 400); }
        if (!d.settings || !Array.isArray(d.categories) || !Array.isArray(d.products) || !Array.isArray(d.slides))
          return out({ error: "bad data" }, 400);
        delete d.settings.password;
        await env.SHOP.put("site", JSON.stringify(d));
        return out({ ok: true });
      }
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname === "/api/login" && request.method === "POST") {
      let pw = "";
      try { pw = (await request.json()).password || ""; } catch {}
      if (env.ADMIN_PASSWORD && (await same(pw, env.ADMIN_PASSWORD))) return out({ ok: true });
      await new Promise((r) => setTimeout(r, 800));
      return out({ error: "unauthorized" }, 401);
    }

    return env.ASSETS.fetch(request);
  },
};
