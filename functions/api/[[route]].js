/* ============================================================
   LUXX – Cloudflare Pages Functions API (D1 edition)
   Binding: LUXX_DB (D1)  |  Env: LUXX_SESSION_SECRET
   ============================================================ */

const ITERATIONS        = 100000;
const SESSION_TTL_MS    = 1000 * 60 * 60 * 24 * 7;
const SCRIPT_POLL_WINDOW_MS = 10000;

// ---------------------------------------------------------------------------
// Web-Crypto helpers
// ---------------------------------------------------------------------------

async function randomId(bytes = 16) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalizeEmail(e) { return String(e || '').trim().toLowerCase(); }

async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashLicenseKey(key) { return sha256hex(String(key || '').trim().toUpperCase()); }

async function createPasswordHash(password) {
  const salt = await randomId(16);
  const enc  = new TextEncoder();
  const km   = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: ITERATIONS, hash: 'SHA-256' }, km, 256);
  const hex  = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${ITERATIONS}:${salt}:${hex}`;
}

async function verifyPassword(password, stored) {
  if (!stored) return false;
  const parts = stored.split(':');
  if (parts.length !== 3) return false;
  const [iters, salt, origHex] = parts;
  const enc  = new TextEncoder();
  const km   = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: Number(iters), hash: 'SHA-256' }, km, 256);
  const hex  = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === origHex;
}

function b64uEnc(s) { return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64uDec(s) { let r = s.replace(/-/g, '+').replace(/_/g, '/'); while (r.length % 4) r += '='; return atob(r); }

async function createSessionToken(secret, payload) {
  const body = b64uEnc(JSON.stringify(payload));
  const enc  = new TextEncoder();
  const key  = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig  = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return `${body}.${b64uEnc(String.fromCharCode(...new Uint8Array(sig)))}`;
}

async function verifySessionToken(secret, token) {
  if (!token || !token.includes('.')) return null;
  const [body, sigB64u] = token.split('.');
  const enc  = new TextEncoder();
  const key  = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const pad  = sigB64u.replace(/-/g, '+').replace(/_/g, '/');
  const padded = pad.padEnd(pad.length + (4 - pad.length % 4) % 4, '=');
  const sigBuf = new Uint8Array([...atob(padded)].map(c => c.charCodeAt(0)));
  const ok = await crypto.subtle.verify('HMAC', key, sigBuf, enc.encode(body));
  if (!ok) return null;
  try {
    const pl = JSON.parse(b64uDec(body));
    if (!pl.expiresAt || pl.expiresAt < Date.now()) return null;
    return pl;
  } catch { return null; }
}

function cookieHeader(token) {
  return `luxx_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; Secure`;
}
function clearCookieHeader() { return 'luxx_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure'; }

// ---------------------------------------------------------------------------
// D1 – schema + seed
// ---------------------------------------------------------------------------

async function ensureSchema(db) {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', is_banned INTEGER NOT NULL DEFAULT 0, license_key_id TEXT, discord_username TEXT NOT NULL DEFAULT '', discord_id TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_login_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS license_keys (id TEXT PRIMARY KEY, key_preview TEXT NOT NULL, key_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_by TEXT, note TEXT, claimed_by_user_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, claimed_at TEXT, expires_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS configs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, tier TEXT NOT NULL DEFAULT 'Legit', description TEXT, lua_content TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1, visibility TEXT NOT NULL DEFAULT 'private', price INTEGER NOT NULL DEFAULT 0, is_published INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS purchases (id TEXT PRIMARY KEY, buyer_id TEXT NOT NULL, config_id TEXT NOT NULL, config_name TEXT, seller_id TEXT, price_paid INTEGER NOT NULL DEFAULT 0, purchased_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS script_sessions (id TEXT PRIMARY KEY, user_id TEXT UNIQUE NOT NULL, session_code TEXT NOT NULL, online INTEGER NOT NULL DEFAULT 0, game TEXT, executor TEXT, version TEXT, last_seen_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS panel_defaults (id TEXT PRIMARY KEY, dashboard_title TEXT NOT NULL DEFAULT 'LUXX', dashboard_tier TEXT NOT NULL DEFAULT 'Custom', dashboard_description TEXT, dashboard_lua_content TEXT, updated_at TEXT NOT NULL, updated_by TEXT)`,
    `CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, actor_user_id TEXT, action TEXT NOT NULL, details TEXT, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS password_resets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS db_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  ];
  for (const s of stmts) await db.exec(s + ';');
}

async function seedIfNeeded(db) {
  const row = await db.prepare('SELECT value FROM db_meta WHERE key=?').bind('seeded').first();
  if (row) return;
  const now = new Date().toISOString();
  const adminId = await randomId(16);
  const adminLicId = await randomId(16);
  const starterLicId = await randomId(16);
  const adminPwHash  = await createPasswordHash('adminhelllo1234');
  const adminKeyHash = await hashLicenseKey('ADMIN-INTERNAL-KEY');
  const startKeyHash = await hashLicenseKey('adminkey1234');
  const DEFAULT_LUA  = "shared.luxxcc = {\n\t['Globals'] = {\n\t\t['Key'] = \"YOUR-KEY-HERE\",\n\t},\n}";
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO users (id,email,password_hash,display_name,role,is_banned,license_key_id,discord_username,discord_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(adminId,'admin',adminPwHash,'Luxx Admin','admin',0,adminLicId,'','',now,now),
    db.prepare('INSERT OR IGNORE INTO license_keys (id,key_preview,key_hash,status,created_by,note,claimed_by_user_id,created_at,updated_at,claimed_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(adminLicId,'ADMIN-INTERNAL-KEY',adminKeyHash,'used','system','Seed admin license',adminId,now,now,now),
    db.prepare('INSERT OR IGNORE INTO license_keys (id,key_preview,key_hash,status,created_by,note,claimed_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(starterLicId,'adminkey1234',startKeyHash,'active','system','Starter registration key',null,now,now),
    db.prepare('INSERT OR IGNORE INTO panel_defaults (id,dashboard_title,dashboard_tier,dashboard_description,dashboard_lua_content,updated_at,updated_by) VALUES (?,?,?,?,?,?,?)').bind('singleton','LUXX','Custom','Bundled LUXX config.',DEFAULT_LUA,now,adminId),
    db.prepare('INSERT OR IGNORE INTO db_meta (key,value) VALUES (?,?)').bind('seeded','1'),
  ]);
}

// ---------------------------------------------------------------------------
// Lua injection
// ---------------------------------------------------------------------------

function injectLicenseIntoLua(lua, key) {
  if (typeof lua !== 'string' || !key) return lua;
  return lua.replace(/(\['Key'\]\s*=\s*)([^,\r\n]+)/, (_, p1) => `${p1}"${key}"`);
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToUser(r) {
  if (!r) return null;
  return { id: r.id, email: r.email, passwordHash: r.password_hash, displayName: r.display_name, role: r.role, isBanned: Boolean(r.is_banned), licenseKeyId: r.license_key_id, discordUsername: r.discord_username || '', discordId: r.discord_id || '', createdAt: r.created_at, updatedAt: r.updated_at, lastLoginAt: r.last_login_at };
}
function rowToLicense(r) {
  if (!r) return null;
  return { id: r.id, keyPreview: r.key_preview, keyHash: r.key_hash, status: r.status, createdBy: r.created_by, note: r.note, claimedByUserId: r.claimed_by_user_id, createdAt: r.created_at, updatedAt: r.updated_at, claimedAt: r.claimed_at, expiresAt: r.expires_at };
}
function rowToConfig(r) {
  if (!r) return null;
  return { id: r.id, ownerId: r.owner_id, name: r.name, tier: r.tier, description: r.description, luaContent: r.lua_content, isActive: Boolean(r.is_active), visibility: r.visibility, price: r.price, isPublished: Boolean(r.is_published), createdAt: r.created_at, updatedAt: r.updated_at };
}
function rowToSession(r) {
  if (!r) return null;
  return { id: r.id, userId: r.user_id, sessionCode: r.session_code, online: Boolean(r.online), game: r.game, executor: r.executor, version: r.version, lastSeenAt: r.last_seen_at, createdAt: r.created_at, updatedAt: r.updated_at };
}
function rowToPanelDefaults(r) {
  if (!r) return null;
  return { dashboardTitle: r.dashboard_title, dashboardTier: r.dashboard_tier, dashboardDescription: r.dashboard_description, dashboardLuaContent: r.dashboard_lua_content, updatedAt: r.updated_at, updatedBy: r.updated_by };
}

// ---------------------------------------------------------------------------
// Public views
// ---------------------------------------------------------------------------

function publicUser(u, licKeyStr = null) {
  return { id: u.id, email: u.email, displayName: u.displayName, discordUsername: u.discordUsername || null, role: u.role, isBanned: u.isBanned, createdAt: u.createdAt, updatedAt: u.updatedAt, lastLoginAt: u.lastLoginAt, licenseKeyString: licKeyStr || null };
}

function sanitizeConfig(config, ownerUser = null, session = null, licenseKey = null) {
  const lua = injectLicenseIntoLua(config.luaContent, licenseKey);
  return { id: config.id, ownerId: config.ownerId, ownerName: ownerUser ? (ownerUser.displayName || ownerUser.email) : 'Unknown', name: config.name, tier: config.tier, description: config.description, luaContent: lua, preview: lua.split('\n').slice(0, 5).join('\n'), isActive: config.isActive, visibility: config.visibility, price: config.price, isPublished: config.isPublished, createdAt: config.createdAt, updatedAt: config.updatedAt, sessionStatus: session ? { online: session.online, game: session.game, executor: session.executor, lastSeenAt: session.lastSeenAt } : null };
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function dbUser(db, id) { return rowToUser(await db.prepare('SELECT * FROM users WHERE id=?').bind(id).first()); }
async function dbUserByEmail(db, email) { return rowToUser(await db.prepare('SELECT * FROM users WHERE email=?').bind(normalizeEmail(email)).first()); }
async function dbLicenseByHash(db, hash) { return rowToLicense(await db.prepare('SELECT * FROM license_keys WHERE key_hash=?').bind(hash).first()); }
async function dbLicenseById(db, id) { if (!id) return null; return rowToLicense(await db.prepare('SELECT * FROM license_keys WHERE id=?').bind(id).first()); }
async function dbSession(db, userId) { return rowToSession(await db.prepare('SELECT * FROM script_sessions WHERE user_id=?').bind(userId).first()); }
async function dbPanelDefaults(db) { return rowToPanelDefaults(await db.prepare("SELECT * FROM panel_defaults WHERE id='singleton'").first()); }

async function dbAuditLog(db, action, actorUserId, details) {
  await db.prepare('INSERT INTO audit_logs (id,actor_user_id,action,details,created_at) VALUES (?,?,?,?,?)').bind(await randomId(12), actorUserId || null, action, details || null, new Date().toISOString()).run();
}

async function dbUpsertSession(db, userId) {
  let s = await dbSession(db, userId);
  if (!s) {
    const now = new Date().toISOString();
    await db.prepare('INSERT INTO script_sessions (id,user_id,session_code,online,created_at,updated_at) VALUES (?,?,?,0,?,?)').bind(await randomId(12), userId, (await randomId(4)).toUpperCase(), now, now).run();
    s = await dbSession(db, userId);
  }
  return s;
}

async function buildHomePayload(db, user) {
  const license   = await dbLicenseById(db, user.licenseKeyId);
  const licKeyStr = license ? license.keyPreview : null;
  const session   = await dbSession(db, user.id);
  const activeConf = rowToConfig(await db.prepare('SELECT * FROM configs WHERE owner_id=? AND is_active=1 LIMIT 1').bind(user.id).first());
  const defaults  = await dbPanelDefaults(db);
  const targets   = ['http://localhost:5173', 'http://127.0.0.1:5173'];
  const loaderCmd = licKeyStr
    ? `local l="${licKeyStr}";local u={"${targets.join('","')}"};for _,b in ipairs(u) do local ok,s=pcall(function() return game:HttpGet(b.."/api/script/loader?license="..l) end) if ok and s and #s>0 then return loadstring(s)() end end error("LUXX local loader unreachable")`
    : "print('No license key found')";
  return {
    user: publicUser(user, licKeyStr),
    home: {
      scriptConnected: Boolean(session && session.online),
      gameFound: session ? session.game : null,
      executor: session ? session.executor : null,
      sessionCode: session ? session.sessionCode : null,
      lastSeenAt: session ? session.lastSeenAt : null,
      activeConfigId: activeConf ? activeConf.id : null,
      activeConfigName: activeConf ? activeConf.name : null,
      dashboardDefault: defaults ? {
        dashboardTitle: defaults.dashboardTitle,
        dashboardTier: defaults.dashboardTier,
        dashboardDescription: defaults.dashboardDescription,
        dashboardLuaContent: injectLicenseIntoLua(defaults.dashboardLuaContent, licKeyStr),
        updatedAt: defaults.updatedAt,
      } : null,
      loaderCommand: loaderCmd,
    },
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.LUXX_DB;
  if (!db) return new Response(JSON.stringify({ error: 'LUXX_DB D1 binding is missing' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  const SESSION_SECRET = env.LUXX_SESSION_SECRET || 'luxx-dev-session-secret';

  try {
    await ensureSchema(db);
    await seedIfNeeded(db);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'DB init failed: ' + e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const url      = new URL(request.url);
  const pathname = url.pathname.replace(/^\/api/, '') || '/';
  const method   = request.method;

  const json = (status, payload, extra = {}) =>
    new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra } });

  const txt = (status, body, extra = {}) =>
    new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...extra } });

  const getBody = async () => { try { return await request.json(); } catch { return {}; } };

  const parseCookies = () =>
    (request.headers.get('cookie') || '').split(';').reduce((a, p) => {
      const [n, ...v] = p.trim().split('=');
      if (n) a[n.trim()] = v.join('=').trim();
      return a;
    }, {});

  const getUser = async () => {
    const tok = parseCookies().luxx_session;
    const pl  = await verifySessionToken(SESSION_SECRET, tok);
    if (!pl) return null;
    return dbUser(db, pl.userId);
  };

  const requireUser = async () => {
    const u = await getUser();
    if (!u) return [null, json(401, { error: 'Authentication required' })];
    if (u.isBanned) return [null, json(403, { error: 'This account has been banned' })];
    return [u, null];
  };

  const requireAdmin = async () => {
    const [u, err] = await requireUser();
    if (err) return [null, err];
    if (u.role !== 'admin') return [null, json(403, { error: 'Administrator access required' })];
    return [u, null];
  };

  // ── Health ────────────────────────────────────────────────────────────────
  if (pathname === '/health' && method === 'GET') return json(200, { ok: true });

  // ── Register ──────────────────────────────────────────────────────────────
  if (pathname === '/auth/register' && method === 'POST') {
    const body = await getBody();
    const email       = normalizeEmail(body.username || body.email || body.displayName);
    const password    = String(body.password || '');
    const displayName = String(body.displayName || body.username || '').trim() || email;
    const licKey      = String(body.licenseKey || '').trim().toUpperCase();
    const discordUser = String(body.discordUsername || '').trim();
    const discordId   = String(body.discordId || '').trim();
    if (!email || !password || password.length < 8 || !licKey || !discordUser)
      return json(400, { error: 'Username, password (8+ chars), discord username, and license key are required' });
    if (await dbUserByEmail(db, email)) return json(409, { error: 'Username is already registered' });
    const lHash   = await hashLicenseKey(licKey);
    const license = await dbLicenseByHash(db, lHash);
    if (!license || license.status !== 'active') return json(400, { error: 'Invalid or already claimed license key' });
    const uid = await randomId(16);
    const now = new Date().toISOString();
    const pwh = await createPasswordHash(password);
    await db.batch([
      db.prepare('INSERT INTO users (id,email,password_hash,display_name,role,is_banned,license_key_id,discord_username,discord_id,created_at,updated_at,last_login_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(uid, email, pwh, displayName, 'user', 0, license.id, discordUser, discordId, now, now, now),
      db.prepare('UPDATE license_keys SET status=?,claimed_by_user_id=?,claimed_at=?,updated_at=? WHERE id=?').bind('used', uid, now, now, license.id),
      db.prepare('INSERT OR IGNORE INTO script_sessions (id,user_id,session_code,online,created_at,updated_at) VALUES (?,?,?,0,?,?)').bind(await randomId(12), uid, (await randomId(4)).toUpperCase(), now, now),
    ]);
    await dbAuditLog(db, 'auth.register', uid, `Registered with license ${license.keyPreview}`);
    const user  = await dbUser(db, uid);
    const token = await createSessionToken(SESSION_SECRET, { userId: uid, expiresAt: Date.now() + SESSION_TTL_MS });
    return json(201, { user: publicUser(user, license.keyPreview) }, { 'Set-Cookie': cookieHeader(token) });
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  if (pathname === '/auth/login' && method === 'POST') {
    const body  = await getBody();
    const email = normalizeEmail(body.username || body.email);
    const pass  = String(body.password || '');
    const user  = await dbUserByEmail(db, email);
    if (!user || !(await verifyPassword(pass, user.passwordHash))) return json(401, { error: 'Invalid username or password' });
    if (user.isBanned) return json(403, { error: 'This account has been banned' });
    const now = new Date().toISOString();
    await db.prepare('UPDATE users SET last_login_at=?,updated_at=? WHERE id=?').bind(now, now, user.id).run();
    await dbUpsertSession(db, user.id);
    await dbAuditLog(db, 'auth.login', user.id, 'Signed in');
    const license = await dbLicenseById(db, user.licenseKeyId);
    const token   = await createSessionToken(SESSION_SECRET, { userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS });
    return json(200, { user: publicUser(user, license ? license.keyPreview : null) }, { 'Set-Cookie': cookieHeader(token) });
  }

  // ── Check License ─────────────────────────────────────────────────────────
  if (pathname === '/auth/check-license' && method === 'POST') {
    const body    = await getBody();
    const licKey  = String(body.licenseKey || '').trim().toUpperCase();
    if (!licKey) return json(400, { error: 'License key is required' });
    const license = await dbLicenseByHash(db, await hashLicenseKey(licKey));
    if (!license) return json(404, { error: 'Invalid license key' });
    if (license.status === 'active' || !license.claimedByUserId) return json(200, { registered: false });
    const owner = await dbUser(db, license.claimedByUserId);
    return json(200, { registered: true, username: owner ? owner.email : '' });
  }

  // ── Me / Home ─────────────────────────────────────────────────────────────
  if ((pathname === '/auth/me' || pathname === '/home') && method === 'GET') {
    const [user, err] = await requireUser();
    if (err) return err;
    return json(200, await buildHomePayload(db, user));
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  if (pathname === '/auth/logout' && method === 'POST') {
    return json(200, { ok: true }, { 'Set-Cookie': clearCookieHeader() });
  }

  // ── Forgot Password ───────────────────────────────────────────────────────
  if (pathname === '/auth/forgot-password' && method === 'POST') {
    const body = await getBody();
    const user = await dbUserByEmail(db, body.username || body.email);
    if (user) {
      const now = new Date().toISOString();
      await db.prepare('INSERT INTO password_resets (id,user_id,token,created_at,expires_at) VALUES (?,?,?,?,?)').bind(await randomId(12), user.id, await randomId(24), now, new Date(Date.now() + 1800000).toISOString()).run();
      await dbAuditLog(db, 'auth.password_reset.requested', user.id, 'Password reset requested');
    }
    return json(200, { ok: true });
  }

  // ── Reset Password ────────────────────────────────────────────────────────
  if (pathname === '/auth/reset-password' && method === 'POST') {
    const body     = await getBody();
    const resetTok = String(body.resetToken || '');
    const newPw    = String(body.newPassword || '');
    if (!resetTok || newPw.length < 8) return json(400, { error: 'Reset token and a stronger password (8+ chars) are required' });
    const reset = await db.prepare('SELECT * FROM password_resets WHERE token=?').bind(resetTok).first();
    if (!reset || new Date(reset.expires_at).getTime() < Date.now()) return json(400, { error: 'Reset token is invalid or expired' });
    const now = new Date().toISOString();
    await db.batch([
      db.prepare('UPDATE users SET password_hash=?,updated_at=? WHERE id=?').bind(await createPasswordHash(newPw), now, reset.user_id),
      db.prepare('DELETE FROM password_resets WHERE id=?').bind(reset.id),
    ]);
    await dbAuditLog(db, 'auth.password_reset.completed', reset.user_id, 'Password reset completed');
    return json(200, { ok: true });
  }

  // ── Configs List ──────────────────────────────────────────────────────────
  if (pathname === '/configs' && method === 'GET') {
    const [user, err] = await requireUser();
    if (err) return err;
    const license   = await dbLicenseById(db, user.licenseKeyId);
    const licKeyStr = license ? license.keyPreview : null;
    const { results } = await db.prepare('SELECT * FROM configs WHERE owner_id=? OR is_published=1').bind(user.id).all();
    const all    = results.map(rowToConfig);
    const myCfgs = all.filter(c => c.ownerId === user.id);
    const mkt    = all.filter(c => c.isPublished);
    const myOut  = await Promise.all(myCfgs.map(async c => sanitizeConfig(c, user, await dbSession(db, user.id), licKeyStr)));
    const mktOut = await Promise.all(mkt.map(async c => {
      const owner = c.ownerId === user.id ? user : rowToUser(await db.prepare('SELECT * FROM users WHERE id=?').bind(c.ownerId).first());
      return sanitizeConfig(c, owner, await dbSession(db, c.ownerId), licKeyStr);
    }));
    const { results: purchases } = await db.prepare('SELECT * FROM purchases WHERE buyer_id=?').bind(user.id).all();
    return json(200, { myConfigs: myOut, marketplace: mktOut, purchases });
  }

  // ── Configs Create ────────────────────────────────────────────────────────
  if (pathname === '/configs' && method === 'POST') {
    const [user, err] = await requireUser();
    if (err) return err;
    const body = await getBody();
    if (!body.name || !body.luaContent) return json(400, { error: 'Config name and Lua content are required' });
    const row     = await db.prepare('SELECT COUNT(*) as cnt FROM configs WHERE owner_id=?').bind(user.id).first();
    const isFirst = row.cnt === 0;
    const cid = await randomId(16);
    const now = new Date().toISOString();
    await db.prepare('INSERT INTO configs (id,owner_id,name,tier,description,lua_content,is_active,visibility,price,is_published,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(cid, user.id, String(body.name).trim(), body.tier || 'Legit', String(body.description || ''), String(body.luaContent || ''), isFirst ? 1 : 0, body.visibility || 'private', Number(body.price || 0), body.isPublished ? 1 : 0, now, now).run();
    await dbAuditLog(db, 'config.created', user.id, `Created config ${body.name}`);
    const config  = rowToConfig(await db.prepare('SELECT * FROM configs WHERE id=?').bind(cid).first());
    const license = await dbLicenseById(db, user.licenseKeyId);
    return json(201, { config: sanitizeConfig(config, user, null, license ? license.keyPreview : null) });
  }

  // ── Configs Activate ──────────────────────────────────────────────────────
  if (pathname === '/configs/activate' && method === 'POST') {
    const [user, err] = await requireUser();
    if (err) return err;
    const body   = await getBody();
    const target = rowToConfig(await db.prepare('SELECT * FROM configs WHERE id=? AND owner_id=?').bind(body.configId, user.id).first());
    if (!target) return json(404, { error: 'Config not found' });
    const now = new Date().toISOString();
    await db.batch([
      db.prepare('UPDATE configs SET is_active=0,updated_at=? WHERE owner_id=?').bind(now, user.id),
      db.prepare('UPDATE configs SET is_active=1,updated_at=? WHERE id=?').bind(now, target.id),
    ]);
    await dbAuditLog(db, 'config.activated', user.id, `Activated config ${target.name}`);
    return json(200, { ok: true });
  }

  // ── Configs Update ────────────────────────────────────────────────────────
  if (pathname.startsWith('/configs/') && method === 'PUT') {
    const [user, err] = await requireUser();
    if (err) return err;
    const configId = pathname.split('/')[2];
    const body     = await getBody();
    const existing = rowToConfig(await db.prepare('SELECT * FROM configs WHERE id=? AND owner_id=?').bind(configId, user.id).first());
    if (!existing) return json(404, { error: 'Config not found' });
    const now = new Date().toISOString();
    const upd = {
      name:        body.name        != null ? body.name        : existing.name,
      tier:        body.tier        != null ? body.tier        : existing.tier,
      description: body.description != null ? body.description : existing.description,
      luaContent:  body.luaContent  != null ? body.luaContent  : existing.luaContent,
      visibility:  body.visibility  != null ? body.visibility  : existing.visibility,
      price:       body.price       != null ? body.price       : existing.price,
      isPublished: body.isPublished != null ? (body.isPublished ? 1 : 0) : (existing.isPublished ? 1 : 0),
    };
    await db.prepare('UPDATE configs SET name=?,tier=?,description=?,lua_content=?,visibility=?,price=?,is_published=?,updated_at=? WHERE id=?').bind(upd.name, upd.tier, upd.description, upd.luaContent, upd.visibility, upd.price, upd.isPublished, now, configId).run();
    if (body.isActive === true) {
      await db.batch([
        db.prepare('UPDATE configs SET is_active=0,updated_at=? WHERE owner_id=?').bind(now, user.id),
        db.prepare('UPDATE configs SET is_active=1,updated_at=? WHERE id=?').bind(now, configId),
      ]);
    }
    await dbAuditLog(db, 'config.updated', user.id, `Updated config ${upd.name}`);
    const fresh   = rowToConfig(await db.prepare('SELECT * FROM configs WHERE id=?').bind(configId).first());
    const license = await dbLicenseById(db, user.licenseKeyId);
    return json(200, { config: sanitizeConfig(fresh, user, null, license ? license.keyPreview : null) });
  }

  // ── Configs Delete ────────────────────────────────────────────────────────
  if (pathname.startsWith('/configs/') && method === 'DELETE') {
    const [user, err] = await requireUser();
    if (err) return err;
    const configId = pathname.split('/')[2];
    const existing = rowToConfig(await db.prepare('SELECT * FROM configs WHERE id=? AND owner_id=?').bind(configId, user.id).first());
    if (!existing) return json(404, { error: 'Config not found' });
    await db.prepare('DELETE FROM configs WHERE id=?').bind(configId).run();
    await dbAuditLog(db, 'config.deleted', user.id, `Deleted config ${existing.name}`);
    return json(200, { ok: true });
  }

  // ── Marketplace Purchase ──────────────────────────────────────────────────
  if (pathname === '/marketplace/purchase' && method === 'POST') {
    const [user, err] = await requireUser();
    if (err) return err;
    const body   = await getBody();
    const config = rowToConfig(await db.prepare('SELECT * FROM configs WHERE id=? AND is_published=1').bind(body.configId).first());
    if (!config) return json(404, { error: 'Listing not found' });
    const dup = await db.prepare('SELECT id FROM purchases WHERE buyer_id=? AND config_id=?').bind(user.id, config.id).first();
    if (!dup && config.ownerId !== user.id) {
      await db.prepare('INSERT INTO purchases (id,buyer_id,config_id,config_name,seller_id,price_paid,purchased_at) VALUES (?,?,?,?,?,?,?)').bind(await randomId(12), user.id, config.id, config.name, config.ownerId, config.price, new Date().toISOString()).run();
    }
    await dbAuditLog(db, 'marketplace.purchase', user.id, `Purchased config ${config.name}`);
    return json(200, { ok: true });
  }

  // ── Admin Overview ────────────────────────────────────────────────────────
  if (pathname === '/admin/overview' && method === 'GET') {
    const [, err] = await requireAdmin();
    if (err) return err;
    const { results: uRows } = await db.prepare('SELECT * FROM users').all();
    const { results: lRows } = await db.prepare('SELECT * FROM license_keys').all();
    const { results: cRows } = await db.prepare('SELECT * FROM configs').all();
    const { results: pRows } = await db.prepare('SELECT * FROM purchases').all();
    const { results: aRows } = await db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 250').all();
    const defaults = await dbPanelDefaults(db);
    const licMap  = {};
    lRows.forEach(r => { const l = rowToLicense(r); licMap[l.id] = l; });
    const userMap = {};
    uRows.forEach(r => { userMap[r.id] = rowToUser(r); });
    return json(200, {
      users: uRows.map(r => { const u = rowToUser(r); return publicUser(u, u.licenseKeyId && licMap[u.licenseKeyId] ? licMap[u.licenseKeyId].keyPreview : null); }),
      licenseKeys: lRows.map(rowToLicense),
      configs: cRows.map(r => sanitizeConfig(rowToConfig(r), userMap[r.owner_id] || null)),
      purchases: pRows,
      auditLogs: aRows,
      panelDefaults: defaults,
    });
  }

  // ── Admin Panel Defaults ──────────────────────────────────────────────────
  if (pathname === '/admin/panel-defaults' && method === 'PUT') {
    const [admin, err] = await requireAdmin();
    if (err) return err;
    const body  = await getBody();
    const title = String(body.dashboardTitle || '').trim();
    const tier  = String(body.dashboardTier  || '').trim();
    const lua   = String(body.dashboardLuaContent || '');
    const desc  = String(body.dashboardDescription || '').trim();
    if (!title || !tier || !lua.trim()) return json(400, { error: 'Title, tier, and Lua content are required' });
    const now = new Date().toISOString();
    await db.prepare('INSERT OR REPLACE INTO panel_defaults (id,dashboard_title,dashboard_tier,dashboard_description,dashboard_lua_content,updated_at,updated_by) VALUES (?,?,?,?,?,?,?)').bind('singleton', title, tier, desc, lua, now, admin.id).run();
    await dbAuditLog(db, 'admin.panel_defaults.updated', admin.id, `Updated dashboard ${title}`);
    return json(200, { panelDefaults: await dbPanelDefaults(db) });
  }

  // ── Admin Create License ──────────────────────────────────────────────────
  if (pathname === '/admin/license-keys' && method === 'POST') {
    const [admin, err] = await requireAdmin();
    if (err) return err;
    const body   = await getBody();
    const rawKey = String(body.key || '').trim().toUpperCase();
    if (!rawKey) return json(400, { error: 'License key is required' });
    const lHash = await hashLicenseKey(rawKey);
    if (await dbLicenseByHash(db, lHash)) return json(409, { error: 'That license key already exists' });
    const lid = await randomId(16);
    const now = new Date().toISOString();
    await db.prepare('INSERT INTO license_keys (id,key_preview,key_hash,status,created_by,note,claimed_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(lid, rawKey, lHash, 'active', admin.id, String(body.note || ''), null, now, now).run();
    await dbAuditLog(db, 'license.created', admin.id, `Created license ${rawKey}`);
    return json(201, { licenseKey: rowToLicense(await db.prepare('SELECT * FROM license_keys WHERE id=?').bind(lid).first()) });
  }

  // ── Admin Update User ─────────────────────────────────────────────────────
  if (pathname.startsWith('/admin/users/') && method === 'PUT') {
    const [, err] = await requireAdmin();
    if (err) return err;
    const targetId = pathname.split('/')[3];
    const body     = await getBody();
    const target   = await dbUser(db, targetId);
    if (!target) return json(404, { error: 'User not found' });
    const now    = new Date().toISOString();
    const banned = typeof body.isBanned === 'boolean' ? (body.isBanned ? 1 : 0) : (target.isBanned ? 1 : 0);
    const role   = (body.role === 'admin' || body.role === 'user') ? body.role : target.role;
    await db.prepare('UPDATE users SET is_banned=?,role=?,updated_at=? WHERE id=?').bind(banned, role, now, targetId).run();
    const fresh = await dbUser(db, targetId);
    const lic   = await dbLicenseById(db, fresh.licenseKeyId);
    return json(200, { user: publicUser(fresh, lic ? lic.keyPreview : null) });
  }

  // ── Admin Update Config (moderation) ─────────────────────────────────────
  if (pathname.startsWith('/admin/configs/') && method === 'PUT') {
    const [, err] = await requireAdmin();
    if (err) return err;
    const cid    = pathname.split('/')[3];
    const body   = await getBody();
    const config = rowToConfig(await db.prepare('SELECT * FROM configs WHERE id=?').bind(cid).first());
    if (!config) return json(404, { error: 'Config not found' });
    const now   = new Date().toISOString();
    const pub   = typeof body.isPublished === 'boolean' ? (body.isPublished ? 1 : 0) : (config.isPublished ? 1 : 0);
    const vis   = ['public', 'private', 'premium'].includes(body.visibility) ? body.visibility : config.visibility;
    const price = typeof body.price === 'number' ? body.price : config.price;
    await db.prepare('UPDATE configs SET is_published=?,visibility=?,price=?,updated_at=? WHERE id=?').bind(pub, vis, price, now, cid).run();
    return json(200, { config: rowToConfig(await db.prepare('SELECT * FROM configs WHERE id=?').bind(cid).first()) });
  }

  // ── Script Heartbeat ──────────────────────────────────────────────────────
  if (pathname === '/script/heartbeat' && (method === 'POST' || method === 'GET')) {
    let licKeyRaw, game, executor, version;
    if (method === 'POST') {
      const b = await getBody();
      licKeyRaw = b.licenseKey || b.license; game = b.game; executor = b.executor; version = b.version;
    } else {
      licKeyRaw = url.searchParams.get('licenseKey') || url.searchParams.get('license');
      game = url.searchParams.get('game'); executor = url.searchParams.get('executor'); version = url.searchParams.get('version');
    }
    const licKey = String(licKeyRaw || request.headers.get('x-luxx-license') || '').trim().toUpperCase();
    if (!licKey) return json(400, { error: 'License key is required' });
    const license = await dbLicenseByHash(db, await hashLicenseKey(licKey));
    if (!license || !license.claimedByUserId) return json(403, { error: 'License is not linked to a user account' });
    const user = await dbUser(db, license.claimedByUserId);
    if (!user || user.isBanned) return json(403, { error: 'Account is unavailable' });
    const now = new Date().toISOString();
    await dbUpsertSession(db, user.id);
    await db.prepare('UPDATE script_sessions SET online=1,game=?,executor=?,version=?,last_seen_at=?,updated_at=? WHERE user_id=?').bind(game || 'Unknown Game', executor || 'Unknown Executor', version || null, now, now, user.id).run();
    const activeConf = rowToConfig(await db.prepare('SELECT * FROM configs WHERE owner_id=? AND is_active=1 LIMIT 1').bind(user.id).first());
    return json(200, { ok: true, userId: user.id, activeConfigId: activeConf ? activeConf.id : null, activeConfigName: activeConf ? activeConf.name : null, activeConfigUpdatedAt: activeConf ? activeConf.updatedAt : null, activeConfigLua: activeConf ? injectLicenseIntoLua(activeConf.luaContent, licKey) : null, canOpenPanel: Boolean(activeConf) });
  }

  // ── Script Status ─────────────────────────────────────────────────────────
  if (pathname === '/script/status' && method === 'GET') {
    const [user, err] = await requireUser();
    if (err) return err;
    const sess   = await dbSession(db, user.id);
    const online = sess && sess.lastSeenAt && (Date.now() - new Date(sess.lastSeenAt).getTime()) < SCRIPT_POLL_WINDOW_MS * 9;
    return json(200, { online: Boolean(sess && sess.online && online), game: sess ? sess.game : null, executor: sess ? sess.executor : null, lastSeenAt: sess ? sess.lastSeenAt : null, sessionCode: sess ? sess.sessionCode : null });
  }

  // ── Script Loader ─────────────────────────────────────────────────────────
  if (pathname === '/script/loader' && method === 'GET') {
    const licKey = String(url.searchParams.get('license') || url.searchParams.get('licenseKey') || '').trim().toUpperCase();
    if (!licKey) return json(400, { error: 'License key is required' });
    const license = await dbLicenseByHash(db, await hashLicenseKey(licKey));
    if (!license || !license.claimedByUserId) return json(403, { error: 'License is not linked to a user account' });
    const user = await dbUser(db, license.claimedByUserId);
    if (!user || user.isBanned) return json(403, { error: 'Account is unavailable' });
    const stub = `-- LUXX Loader\n-- License: ${licKey}\nprint("LUXX loaded for ${user.displayName}")`;
    return txt(200, injectLicenseIntoLua(stub, licKey), { 'Cache-Control': 'no-store' });
  }

  return json(404, { error: 'Route not found' });
}
