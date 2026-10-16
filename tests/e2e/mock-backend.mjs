// Lokální napodobenina Supabase (Auth, PostgREST, Storage) a Resend API
// pro end-to-end testy bez přístupu k internetu. Data jsou jen v paměti.
// NENÍ součástí produkční aplikace. RLS je zde zjednodušené – skutečná
// pravidla testuje supabase/tests/10_rls_test.sql proti PostgreSQL.
import { createHmac, randomUUID } from "node:crypto";
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 54321);
const JWT_SECRET = "mock-secret";
const ADMIN = { id: "11111111-1111-1111-1111-111111111111", email: "majitel@example.cz", password: "TestovaciHeslo123" };
const VISITOR = { id: "22222222-2222-2222-2222-222222222222", email: "host@example.cz", password: "TestovaciHeslo123" };
const USERS = [ADMIN, VISITOR];
const ADMINS = new Set([ADMIN.id]);

const now = () => new Date().toISOString();
const db = {
  site_settings: [
    {
      id: 1,
      restaurant_name: "Restaurace Rybníky",
      phone: "+420 602 163 330",
      email: "info@rybnickarestaurace.cz",
      address_street: "Rybníky 40",
      address_zip: "263 01",
      address_city: "Dobříš",
      latitude: null,
      longitude: null,
      opening_hours: [],
      opening_hours_note: null,
      services: [
        { key: "daily_menu", label: "Denní menu", enabled: true },
        { key: "beer_snacks", label: "Chuťovky k pivu", enabled: true },
        { key: "garden", label: "Venkovní zahrádka", enabled: true },
        { key: "wifi", label: "Wi-Fi", enabled: true },
      ],
      texts: {
        hero_eyebrow: "Rybníky u Dobříše",
        hero_title: "Restaurace Rybníky",
        hero_subtitle: "Česká restaurace a hospoda s denním menu, točeným pivem, salonky, sálem pro oslavy a venkovní zahrádkou.",
        about_title: "Hospoda, kam se rádi vracíte",
        about_text: "Restaurace Rybníky je místo pro polední menu, večerní posezení u piva i rodinné oslavy.",
        menu_note: "Denní menu zveřejňujeme každý den v tomto místě.",
        spaces_intro: "Pro posezení s přáteli, firemní akci, svatbu nebo rodinnou oslavu.",
        sport_intro: "Sledujte s námi zápasy a závody v příjemné hospodské atmosféře.",
      },
      logo_path: null,
      hero_image_path: null,
      facebook_url: null,
      instagram_url: null,
      updated_at: now(),
    },
  ],
  private_settings: [{ id: 1, menu_email_recipient: "info@rybnickarestaurace.cz", menu_email_enabled: true, inquiry_email_recipient: "info@rybnickarestaurace.cz", updated_at: now() }],
  daily_menus: [],
  menu_email_log: [],
  menu_categories: [
    { id: randomUUID(), kind: "food", name: "Polévky", description: null, sort_order: 10, is_visible: true, created_at: now() },
    { id: randomUUID(), kind: "food", name: "Chuťovky k pivu", description: null, sort_order: 30, is_visible: true, created_at: now() },
    { id: randomUUID(), kind: "drink", name: "Pivo", description: null, sort_order: 10, is_visible: true, created_at: now() },
  ],
  menu_items: [],
  spaces: [
    ["vycep", "Hlavní výčep", "Srdce hospody – posezení u točeného piva, chuťovky a sportovní přenosy.", 10],
    ["salonek-1", "Salonek", "Oddělený prostor pro menší společnost.", 20],
    ["salonek-2", "Druhý salonek", "Další samostatný salonek.", 30],
    ["sal", "Sál", "Prostor pro větší akce – oslavy, svatby, firemní večírky.", 40],
    ["zahradka", "Venkovní zahrádka", "Posezení venku za hezkého počasí.", 50],
  ].map(([slug, name, description, sort_order]) => ({ id: randomUUID(), slug, name, description, capacity: null, capacity_note: null, cover_path: null, sort_order, is_visible: true, updated_at: now() })),
  gallery_photos: [],
  sport_events: [],
  inquiries: [],
  admin_users: [{ user_id: ADMIN.id, created_at: now() }],
};
const storage = new Map(); // `${bucket}/${path}` → { body: Buffer, type }
const BUCKETS = {
  menus: { limit: 15 * 1024 * 1024, types: ["image/png"] },
  media: { limit: 10 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/svg+xml"] },
};

const resend = { mode: "ok", emails: [] };

// ------------------------------------------------------------------ JWT
const b64u = (b) => Buffer.from(b).toString("base64url");
function sign(user) {
  const header = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload = b64u(JSON.stringify({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", exp, iat: exp - 3600 }));
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}
function verify(token) {
  const [h, p, s] = (token ?? "").split(".");
  if (!s) return null;
  if (createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url") !== s) return null;
  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  if (payload.exp < Date.now() / 1000) return null;
  return USERS.find((u) => u.id === payload.sub) ?? null;
}
const userJson = (u) => ({ id: u.id, aud: "authenticated", role: "authenticated", email: u.email, app_metadata: {}, user_metadata: {}, created_at: now() });
function session(u) {
  return { access_token: sign(u), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `r-${u.id}`, user: userJson(u) };
}

// ------------------------------------------------------------------ helpers
function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  res.writeHead(status, { "Content-Type": isBuf ? headers["Content-Type"] ?? "application/octet-stream" : "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", "Access-Control-Expose-Headers": "Content-Range", ...headers });
  res.end(isBuf ? body : body === undefined ? "" : JSON.stringify(body));
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}
const SERVICE_KEY = "mock-service-role-key";
function currentUser(req) {
  const auth = req.headers.authorization?.replace(/^Bearer /, "");
  if (auth === SERVICE_KEY) return { id: "service", service: true };
  return verify(auth);
}
// service role obchází RLS stejně jako v Supabase
const isAdmin = (u) => Boolean(u && (u.service || ADMINS.has(u.id)));

function parseFilters(params) {
  const filters = [];
  for (const [key, value] of params) {
    if (["select", "order", "limit", "offset", "columns", "on_conflict"].includes(key)) continue;
    const m = /^(eq|neq|gte|lte|gt|lt|is)\.(.*)$/.exec(value);
    if (m) filters.push({ col: key, op: m[1], val: decodeURIComponent(m[2]) });
  }
  return filters;
}
function cmp(a, b) {
  return a === b ? 0 : a === null || a === undefined ? -1 : b === null || b === undefined ? 1 : a < b ? -1 : 1;
}
function match(row, f) {
  const v = row[f.col];
  const s = v === null || v === undefined ? null : typeof v === "boolean" ? String(v) : typeof v === "number" ? v : String(v);
  const t = f.val === "null" ? null : typeof s === "number" ? Number(f.val) : f.val;
  switch (f.op) {
    case "eq": return s === t;
    case "neq": return s !== t;
    case "is": return s === t;
    case "gte": return cmp(s, t) >= 0;
    case "lte": return cmp(s, t) <= 0;
    case "gt": return cmp(s, t) > 0;
    case "lt": return cmp(s, t) < 0;
  }
  return true;
}
function applyOrder(rows, order) {
  if (!order) return rows;
  const keys = order.split(",").map((o) => {
    const [col, dir] = o.split(".");
    return { col, desc: dir === "desc" };
  });
  return [...rows].sort((a, b) => {
    for (const k of keys) {
      const c = cmp(a[k.col], b[k.col]);
      if (c) return k.desc ? -c : c;
    }
    return 0;
  });
}

// zjednodušené RLS pro čtení
function visibleRows(table, user) {
  const rows = db[table] ?? [];
  if (isAdmin(user)) return rows;
  switch (table) {
    case "daily_menus": return rows.filter((r) => r.is_current);
    case "private_settings":
    case "inquiries":
    case "menu_email_log": return [];
    case "admin_users": return rows.filter((r) => user && r.user_id === user.id);
    case "menu_categories":
    case "spaces":
    case "gallery_photos":
    case "sport_events": return rows.filter((r) => r.is_visible);
    case "menu_items": return rows.filter((r) => r.is_visible && db.menu_categories.find((c) => c.id === r.category_id)?.is_visible);
    default: return rows;
  }
}

const DEFAULTS = {
  daily_menus: () => ({ id: randomUUID(), uploaded_at: now(), is_current: false, first_published_at: null, published_at: null, publish_count: 0, email_status: "pending", email_recipient: null, email_sent_at: null, email_provider_id: null, email_last_error: null, email_attempts: 0, email_claimed_at: null, width: null, height: null, sha256: null, uploaded_by: null }),
  menu_email_log: () => ({ id: randomUUID(), created_at: now() }),
  menu_categories: () => ({ id: randomUUID(), description: null, sort_order: 0, is_visible: true, created_at: now() }),
  menu_items: () => ({ id: randomUUID(), description: null, portion: null, price: null, price_note: null, allergens: null, sort_order: 0, is_visible: true, created_at: now(), updated_at: now() }),
  spaces: () => ({ id: randomUUID(), description: null, capacity: null, capacity_note: null, cover_path: null, sort_order: 0, is_visible: true, updated_at: now() }),
  gallery_photos: () => ({ id: randomUUID(), alt: "", category: "restaurace", space_id: null, width: null, height: null, sort_order: 0, is_visible: true, created_at: now() }),
  sport_events: () => ({ id: randomUUID(), description: null, is_visible: true, created_at: now() }),
  inquiries: () => ({ id: randomUUID(), status: "new", email_notified: false, created_at: now() }),
};

// ------------------------------------------------------------------ RPC
const rpc = {
  is_admin: (_, user) => isAdmin(user),
  publish_menu: ({ p_menu_id }, user) => {
    if (!isAdmin(user)) throw { status: 403, body: { code: "42501", message: "Přístup odepřen" } };
    const menu = db.daily_menus.find((m) => m.id === p_menu_id);
    if (!menu) throw { status: 404, body: { code: "P0002", message: "Menu nenalezeno" } };
    for (const m of db.daily_menus) if (m.id !== p_menu_id) m.is_current = false;
    menu.is_current = true;
    menu.published_at = now();
    menu.first_published_at ??= menu.published_at;
    menu.publish_count += 1;
    return menu;
  },
  claim_menu_email: ({ p_menu_id, p_force }, user) => {
    if (!isAdmin(user)) throw { status: 403, body: { code: "42501", message: "Přístup odepřen" } };
    const m = db.daily_menus.find((x) => x.id === p_menu_id);
    if (!m) return [];
    const stale = m.email_status === "sending" && Date.now() - new Date(m.email_claimed_at).getTime() > 5 * 60 * 1000;
    if (["pending", "failed"].includes(m.email_status) || stale || (p_force && ["sent", "skipped"].includes(m.email_status))) {
      m.email_status = "sending";
      m.email_claimed_at = now();
      m.email_attempts += 1;
      return [m];
    }
    return [];
  },
};

// ------------------------------------------------------------------ server
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    if (req.method === "OPTIONS") return send(res, 204);
    const user = currentUser(req);

    // ---- řízení testů
    if (path === "/__control/resend") {
      resend.mode = url.searchParams.get("mode") ?? "ok";
      return send(res, 200, { mode: resend.mode });
    }
    if (path === "/__control/emails") return send(res, 200, resend.emails);
    if (path === "/__control/db") return send(res, 200, { daily_menus: db.daily_menus, menu_email_log: db.menu_email_log, inquiries: db.inquiries, storage: [...storage.keys()] });

    // ---- Resend
    if (path === "/resend/emails" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)).toString());
      const key = req.headers["idempotency-key"];
      if (!req.headers.authorization?.startsWith("Bearer re_")) return send(res, 401, { name: "missing_api_key", message: "Missing API key", statusCode: 401 });
      if (resend.mode === "fail") return send(res, 500, { name: "application_error", message: "Simulovaný výpadek e-mailové služby", statusCode: 500 });
      const existing = resend.emails.find((e) => key && e.idempotencyKey === key);
      if (existing) return send(res, 200, { id: existing.id });
      const id = randomUUID();
      resend.emails.push({ id, idempotencyKey: key, ...body });
      return send(res, 200, { id });
    }

    // ---- Auth
    if (path === "/auth/v1/token") {
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      const grant = url.searchParams.get("grant_type");
      let u = null;
      if (grant === "password") u = USERS.find((x) => x.email === body.email && x.password === body.password);
      if (grant === "refresh_token") u = USERS.find((x) => `r-${x.id}` === body.refresh_token);
      if (!u) return send(res, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials", error: "invalid_grant", error_description: "Invalid login credentials" });
      return send(res, 200, session(u));
    }
    if (path === "/auth/v1/user") {
      if (!user) return send(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
      return send(res, 200, userJson(user));
    }
    if (path === "/auth/v1/logout") return send(res, 204);
    if (path === "/auth/v1/recover") return send(res, 200, {});

    // ---- Storage
    const pub = /^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/.exec(path);
    if (pub && req.method === "GET") {
      const f = storage.get(`${pub[1]}/${decodeURIComponent(pub[2])}`);
      if (!f) return send(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
      const dl = url.searchParams.get("download");
      return send(res, 200, f.body, { "Content-Type": f.type, "Cache-Control": "public, max-age=31536000", ...(dl !== null ? { "Content-Disposition": `attachment; filename="${dl}"` } : {}) });
    }
    const obj = /^\/storage\/v1\/object\/([^/]+)\/(.+)$/.exec(path);
    if (obj) {
      const [, bucket, raw] = obj;
      const key = `${bucket}/${decodeURIComponent(raw)}`;
      if (req.method === "GET") {
        if (!isAdmin(user)) return send(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
        const f = storage.get(key);
        return f ? send(res, 200, f.body, { "Content-Type": f.type }) : send(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
      }
      if (req.method === "POST" || req.method === "PUT") {
        if (!isAdmin(user)) return send(res, 400, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
        const raw = await readBody(req);
        let body = raw;
        let type = req.headers["content-type"] ?? "application/octet-stream";
        if (type.startsWith("multipart/form-data")) {
          const fd = await new Request("http://x", { method: "POST", headers: { "content-type": type }, body: raw }).formData();
          const file = [...fd.values()].find((v) => typeof v !== "string");
          body = Buffer.from(await file.arrayBuffer());
          type = file.type;
        }
        const b = BUCKETS[bucket];
        if (!b.types.includes(type)) return send(res, 400, { statusCode: "415", error: "invalid_mime_type", message: `mime type ${type} is not supported` });
        if (body.length > b.limit) return send(res, 400, { statusCode: "413", error: "Payload too large", message: "The object exceeded the maximum allowed size" });
        if (storage.has(key) && req.headers["x-upsert"] !== "true") return send(res, 400, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
        storage.set(key, { body, type });
        return send(res, 200, { Key: key, Id: randomUUID() });
      }
    }
    const del = /^\/storage\/v1\/object\/([^/]+)$/.exec(path);
    if (del && req.method === "DELETE") {
      if (!isAdmin(user)) return send(res, 200, []);
      const { prefixes } = JSON.parse((await readBody(req)).toString());
      for (const p of prefixes) storage.delete(`${del[1]}/${p}`);
      return send(res, 200, prefixes.map((name) => ({ name })));
    }

    // ---- PostgREST RPC
    const rpcMatch = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(path);
    if (rpcMatch) {
      const fn = rpc[rpcMatch[1]];
      if (!fn) return send(res, 404, { message: "function not found" });
      const args = JSON.parse((await readBody(req)).toString() || "{}");
      try {
        return send(res, 200, fn(args, user));
      } catch (e) {
        return send(res, e.status ?? 500, e.body ?? { message: String(e) });
      }
    }

    // ---- PostgREST tables
    const t = /^\/rest\/v1\/([a-z_]+)$/.exec(path);
    if (t) {
      const table = t[1];
      if (!db[table]) return send(res, 404, { message: `relation ${table} does not exist` });
      const filters = parseFilters(url.searchParams);
      const select = url.searchParams.get("select") ?? "*";
      const prefer = req.headers.prefer ?? "";
      const wantsObject = (req.headers.accept ?? "").includes("vnd.pgrst.object");
      const returnRows = prefer.includes("return=representation");
      const finish = (rows) => {
        if (wantsObject) {
          if (rows.length !== 1) return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `The result contains ${rows.length} rows` });
          return send(res, 200, rows[0]);
        }
        return send(res, returnRows || req.method === "GET" ? 200 : 204, returnRows || req.method === "GET" ? rows : undefined);
      };

      if (req.method === "GET" || req.method === "HEAD") {
        let rows = visibleRows(table, user).filter((r) => filters.every((f) => match(r, f)));
        rows = applyOrder(rows, url.searchParams.get("order"));
        const total = rows.length;
        const range = req.headers.range;
        if (range) {
          const [a, b] = range.split("-").map(Number);
          rows = rows.slice(a, b + 1);
        }
        const limit = url.searchParams.get("limit");
        if (limit) rows = rows.slice(0, Number(limit));
        if (/items:menu_items/.test(select)) {
          rows = rows.map((c) => ({ ...c, items: applyOrder(visibleRows("menu_items", user).filter((i) => i.category_id === c.id), "sort_order") }));
        }
        const headers = { "Content-Range": `0-${Math.max(0, rows.length - 1)}/${total}` };
        if (req.method === "HEAD") return send(res, 200, undefined, headers);
        if (wantsObject) return finish(rows);
        return send(res, 200, rows, headers);
      }

      if (!isAdmin(user)) return send(res, 401, { code: "42501", message: `permission denied for table ${table}` });
      const body = req.method === "DELETE" ? null : JSON.parse((await readBody(req)).toString() || "null");

      if (req.method === "POST") {
        const input = Array.isArray(body) ? body : [body];
        const created = [];
        for (const row of input) {
          if (table === "daily_menus" && db.daily_menus.some((m) => m.storage_path === row.storage_path)) {
            return send(res, 409, { code: "23505", message: "duplicate key value violates unique constraint" });
          }
          const full = { ...(DEFAULTS[table]?.() ?? {}), ...row };
          db[table].push(full);
          created.push(full);
        }
        return finish(created);
      }
      if (req.method === "PATCH") {
        const rows = db[table].filter((r) => filters.every((f) => match(r, f)));
        for (const r of rows) Object.assign(r, body);
        return finish(rows);
      }
      if (req.method === "DELETE") {
        const rows = db[table].filter((r) => filters.every((f) => match(r, f)));
        db[table] = db[table].filter((r) => !rows.includes(r));
        if (table === "menu_categories") db.menu_items = db.menu_items.filter((i) => !rows.some((c) => c.id === i.category_id));
        return finish(rows);
      }
    }
    send(res, 404, { message: `mock: neznámá cesta ${req.method} ${path}` });
  } catch (e) {
    console.error("[mock]", e);
    send(res, 500, { message: String(e) });
  }
});

server.listen(PORT, "127.0.0.1", () => console.log(`mock backend na http://127.0.0.1:${PORT}`));
