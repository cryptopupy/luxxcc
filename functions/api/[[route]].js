/* Cloudflare Pages Functions API Handler */

// We use Web Crypto API instead of Node.js crypto
const ITERATIONS = 120000;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

// --- Web Crypto Utilities ---

async function randomId(size = 16) {
  const array = new Uint8Array(size);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashLicenseKey(key) {
  return await sha256(String(key || "").trim().toUpperCase());
}

async function createPasswordHash(password) {
  const salt = await randomId(16);
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${ITERATIONS}:${salt}:${hash}`;
}

async function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const parts = storedHash.split(":");
  if (parts.length !== 3) return false;
  const [iterationsText, salt, originalHash] = parts;
  const iterations = Number(iterationsText);
  if (!iterations || !salt || !originalHash) return false;
  
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  const computedHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return computedHash === originalHash;
}

// Simple base64url encode/decode (for Cloudflare Workers)
function b64uEnc(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64uDec(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
}

async function createSessionToken(secret, payload) {
  const body = b64uEnc(JSON.stringify(payload));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const signature = b64uEnc(String.fromCharCode(...new Uint8Array(sigBuf)));
  return `${body}.${signature}`;
}

async function verifySessionToken(secret, token) {
  if (!token || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
  );
  const sigBuf = new Uint8Array(atob(signature.replace(/-/g, '+').replace(/_/g, '/').padEnd(signature.length + (4 - signature.length % 4) % 4, '=')).split('').map(c => c.charCodeAt(0)));
  
  const isValid = await crypto.subtle.verify("HMAC", key, sigBuf, enc.encode(body));
  if (!isValid) return null;
  
  try {
    const payload = JSON.parse(b64uDec(body));
    if (!payload.expiresAt || payload.expiresAt < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

async function createSessionPayload(userId) {
  return {
    userId,
    sessionId: await randomId(12),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
}

function cookieHeader(token) {
  return `luxx_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; Secure`;
}

function clearCookieHeader() {
  return "luxx_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure";
}

// --- KV State Management ---
const STATE_KEY = "LUXX_GLOBAL_STATE";
const DEFAULT_STATE = {
  users: [],
  licenseKeys: [],
  configs: [],
  purchases: [],
  scriptSessions: [],
  passwordResets: [],
  auditLogs: [],
  panelDefaults: {
    dashboardTitle: "LUXX Dashboard",
    dashboardTier: "Private",
    dashboardDescription: "Welcome to LUXX",
    dashboardLuaContent: "return {}"
  }
};

async function readState(kv) {
  const data = await kv.get(STATE_KEY, "json");
  return data || DEFAULT_STATE;
}

async function writeState(kv, state) {
  await kv.put(STATE_KEY, JSON.stringify(state));
}

// Helpers
function publicUser(user, licenseKeys) {
  const license = licenseKeys.find(k => k.id === user.licenseKeyId);
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    discordUsername: user.discordUsername,
    role: user.role,
    isBanned: user.isBanned,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    licenseKeyString: license ? license.keyPreview : null,
  };
}

function resolveLicenseKeyValue(licenseKeys, licenseKeyId) {
  const license = licenseKeys.find((item) => item.id === licenseKeyId);
  return license ? license.keyPreview : null;
}

const configKeyPattern = /(\['Key'\]\s*=\s*)([^,\r\n]+)(,?)/;

function injectLicenseIntoLua(luaContent, licenseKey) {
  if (typeof luaContent !== "string" || !licenseKey) return luaContent;
  if (!configKeyPattern.test(luaContent)) return luaContent;
  return luaContent.replace(configKeyPattern, `$1"${licenseKey}"$3`);
}

function sanitizeConfig(config, owner = null, session = null, licenseKey = null) {
  const luaContent = injectLicenseIntoLua(config.luaContent, licenseKey);
  return {
    id: config.id,
    ownerId: config.ownerId,
    ownerName: owner ? (owner.displayName || owner.email) : "Unknown",
    name: config.name,
    tier: config.tier,
    description: config.description,
    luaContent,
    preview: luaContent.split("\n").slice(0, 5).join("\n"),
    isActive: config.isActive,
    visibility: config.visibility,
    price: config.price,
    isPublished: config.isPublished,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
    sessionStatus: session
      ? {
          online: session.online,
          game: session.game,
          executor: session.executor,
          lastSeenAt: session.lastSeenAt,
        }
      : null,
  };
}

function sanitizePanelDefaults(panelDefaults, licenseKey = null) {
  if (!panelDefaults) return null;
  return {
    dashboardTitle: panelDefaults.dashboardTitle,
    dashboardTier: panelDefaults.dashboardTier,
    dashboardDescription: panelDefaults.dashboardDescription,
    dashboardLuaContent: injectLicenseIntoLua(panelDefaults.dashboardLuaContent, licenseKey),
    updatedAt: panelDefaults.updatedAt,
    updatedBy: panelDefaults.updatedBy,
  };
}

function sanitizeLicenseKey(record) {
  if (!record) return null;
  return { ...record };
}

function addAuditLog(state, action, actorUserId, details) {
  state.auditLogs.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    actorUserId,
    action,
    details,
    createdAt: new Date().toISOString(),
  });
  state.auditLogs = state.auditLogs.slice(0, 250);
}

function resolveScriptSession(state, userId) {
  let session = state.scriptSessions.find((item) => item.userId === userId);
  if (!session) {
    session = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      userId,
      sessionCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
      online: false,
      game: null,
      executor: null,
      version: null,
      lastSeenAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.scriptSessions.push(session);
  }
  return session;
}

// --- Request Handlers ---

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/^\/api/, "") || "/";
  const method = request.method;

  const kv = env.LUXX_KV;
  if (!kv) {
    return new Response(JSON.stringify({ error: "LUXX_KV binding is missing in Cloudflare" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const SESSION_SECRET = env.LUXX_SESSION_SECRET || "luxx-dev-session-secret";

  function json(status, payload, headers = {}) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
    });
  }

  async function getBody() {
    try { return await request.json(); } catch { return {}; }
  }

  function parseCookies(req) {
    const raw = req.headers.get("cookie") || "";
    return raw.split(";").reduce((acc, part) => {
      const [name, ...rest] = part.trim().split("=");
      if (name) acc[name.trim()] = rest.join("=").trim();
      return acc;
    }, {});
  }

  async function currentUser(req, state) {
    const cookies = parseCookies(req);
    const token = cookies.luxx_session;
    const payload = await verifySessionToken(SESSION_SECRET, token);
    if (!payload) return null;
    return state.users.find((user) => user.id === payload.userId) || null;
  }

  // Routes
  if (pathname === "/auth/register" && method === "POST") {
    const body = await getBody();
    const email = normalizeEmail(body.username || body.email || body.displayName);
    const password = String(body.password || "");
    const displayName = String(body.displayName || body.username || "").trim() || email;
    const licenseKey = String(body.licenseKey || "").trim().toUpperCase();
    const discordUsername = String(body.discordUsername || "").trim();
    const discordId = String(body.discordId || "").trim();

    if (!email || !password || password.length < 8 || !licenseKey || !discordUsername) {
      return json(400, { error: "Username, password, discord username, and license key are required" });
    }

    const state = await readState(kv);
    if (state.users.find(u => u.email === email)) {
      return json(409, { error: "Username is already registered" });
    }

    const lHash = await hashLicenseKey(licenseKey);
    const license = state.licenseKeys.find(item => item.keyHash === lHash && item.status === "active");
    if (!license) {
      return json(400, { error: "Invalid or already claimed license key" });
    }

    const user = {
      id: await randomId(16),
      email,
      passwordHash: await createPasswordHash(password),
      displayName,
      discordUsername,
      discordId,
      role: state.users.length === 0 ? "admin" : "user", // First user is admin
      isBanned: false,
      licenseKeyId: license.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    state.users.push(user);
    license.status = "used";
    license.claimedByUserId = user.id;
    license.claimedAt = new Date().toISOString();
    license.updatedAt = new Date().toISOString();

    await writeState(kv, state);
    const payload = await createSessionPayload(user.id);
    const token = await createSessionToken(SESSION_SECRET, payload);

    return json(201, { user: publicUser(user, state.licenseKeys) }, { "Set-Cookie": cookieHeader(token) });
  }

  if (pathname === "/auth/login" && method === "POST") {
    const body = await getBody();
    const email = normalizeEmail(body.username || body.email);
    const password = String(body.password || "");

    const state = await readState(kv);
    const user = state.users.find(u => u.email === email);
    
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return json(401, { error: "Invalid username or password" });
    }
    if (user.isBanned) {
      return json(403, { error: "This account has been banned" });
    }

    user.lastLoginAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();
    await writeState(kv, state);

    const payload = await createSessionPayload(user.id);
    const token = await createSessionToken(SESSION_SECRET, payload);

    return json(200, { user: publicUser(user, state.licenseKeys) }, { "Set-Cookie": cookieHeader(token) });
  }

  if (pathname === "/auth/me" && method === "GET") {
    const state = await readState(kv);
    const user = await currentUser(request, state);
    if (!user) return json(401, { error: "Authentication required" });
    
    return json(200, {
      user: publicUser(user, state.licenseKeys),
      home: {
        scriptConnected: false,
        gameFound: null,
        activeConfigId: null,
        activeConfigName: null,
        dashboardDefault: state.panelDefaults,
        loaderCommand: "print('Loader command not implemented yet')",
      }
    });
  }

  if (pathname === "/auth/logout" && method === "POST") {
    return json(200, { ok: true }, { "Set-Cookie": clearCookieHeader() });
  }

  return json(404, { error: "Route not found" });
}
