import {
  clearCookieHeader,
  cookieHeader,
  createPasswordHash,
  createSessionPayload,
  createSessionToken,
  hashLicenseKey,
  normalizeEmail,
  randomId,
  verifyPassword,
  verifySessionToken,
} from "./auth.js";
import {
  addAuditLog,
  findUserByEmail,
  injectLicenseIntoLua,
  publicUser,
  readState,
  readBundledLuxxLoaderScript,
  resolveLicenseKeyValue,
  sanitizeConfig,
  sanitizeLicenseKey,
  sanitizePanelDefaults,
  updateState,
} from "./store.js";

const SESSION_SECRET = process.env.LUXX_SESSION_SECRET || "luxx-dev-session-secret";
const SCRIPT_POLL_WINDOW_MS = 10000;

function json(res, status, payload, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(payload));
}

function text(res, status, payload, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.end(payload);
}

function notFound(res) {
  json(res, 404, { error: "Not found" });
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return raw.split(";").reduce((acc, part) => {
    const [name, ...rest] = part.trim().split("=");
    if (!name) return acc;
    acc[name] = rest.join("=");
    return acc;
  }, {});
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  if (!chunks.length) return {};
  const bodyText = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(bodyText);
  } catch {
    return {};
  }
}

function currentUser(req, state) {
  const cookies = parseCookies(req);
  const token = cookies.luxx_session;
  const payload = verifySessionToken(SESSION_SECRET, token);
  if (!payload) return null;
  return state.users.find((user) => user.id === payload.userId) || null;
}

function ensureUser(req, res, state) {
  const user = currentUser(req, state);
  if (!user) {
    json(res, 401, { error: "Authentication required" });
    return null;
  }
  if (user.isBanned) {
    json(res, 403, { error: "This account has been banned" });
    return null;
  }
  return user;
}

function ensureAdmin(req, res, state) {
  const user = ensureUser(req, res, state);
  if (!user) return null;
  if (user.role !== "admin") {
    json(res, 403, { error: "Administrator access required" });
    return null;
  }
  return user;
}

function buildHomePayload(state, user) {
  const activeConfig = state.configs.find((config) => config.ownerId === user.id && config.isActive) || null;
  const session = state.scriptSessions.find((item) => item.userId === user.id) || null;
  const viewerLicenseKey = resolveLicenseKeyValue(state.licenseKeys, user.licenseKeyId);
  const loaderTargets = [
    "https://luxxcc.pages.dev",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://[::1]:5173",
  ];
  const loaderCommand = `local l="${viewerLicenseKey || "YOUR-LICENSE"}";local u={"${loaderTargets.join('","')}"};for _,b in ipairs(u) do local ok,s=pcall(function() return game:HttpGet(b.."/api/script/loader?license="..l) end) if ok and s and #s>0 then return loadstring(s)() end end error("LUXX local loader unreachable")`;
  return {
    user: publicUser(user, state.licenseKeys),
    home: {
      scriptConnected: Boolean(session?.online),
      gameFound: session?.game || null,
      executor: session?.executor || null,
      sessionCode: session?.sessionCode || null,
      lastSeenAt: session?.lastSeenAt || null,
      activeConfigId: activeConfig?.id || null,
      activeConfigName: activeConfig?.name || null,
      dashboardDefault: sanitizePanelDefaults(state.panelDefaults, viewerLicenseKey),
      loaderCommand,
    },
  };
}

function listVisibleConfigs(state, user) {
  const viewerLicenseKey = resolveLicenseKeyValue(state.licenseKeys, user.licenseKeyId);
  return state.configs
    .filter((config) => config.isPublished || config.ownerId === user.id)
    .map((config) => {
      const owner = state.users.find((item) => item.id === config.ownerId);
      const session = state.scriptSessions.find((item) => item.userId === config.ownerId);
      return sanitizeConfig(config, owner, session, viewerLicenseKey);
    });
}

function resolveScriptSession(state, userId) {
  let session = state.scriptSessions.find((item) => item.userId === userId);
  if (!session) {
    session = {
      id: randomId(),
      userId,
      sessionCode: randomId(8).toUpperCase(),
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

function cleanupSessions(state) {
  const threshold = Date.now() - SCRIPT_POLL_WINDOW_MS;
  state.scriptSessions = state.scriptSessions.map((session) => {
    if (session.lastSeenAt && new Date(session.lastSeenAt).getTime() >= threshold) {
      return session;
    }
    return {
      ...session,
      online: false,
    };
  });
  return state;
}

export function luxxApiPlugin() {
  return {
    name: "luxx-local-api",
    configureServer(server) {
      server.middlewares.use("/api", async (req, res) => {
        updateState((state) => cleanupSessions(state));
        const url = new URL(req.originalUrl || req.url, "http://localhost");
        const pathname = url.pathname.replace(/^\/api/, "") || "/";

        if (pathname === "/health" && req.method === "GET") {
          return json(res, 200, { ok: true });
        }

        if (pathname === "/auth/register" && req.method === "POST") {
          const body = await readBody(req);
          const email = normalizeEmail(body.username || body.email || body.displayName);
          const password = String(body.password || "");
          const displayName = String(body.displayName || body.username || "").trim() || email;
          const licenseKey = String(body.licenseKey || "").trim().toUpperCase();
          const discordUsername = String(body.discordUsername || "").trim();
          if (!email || !password || password.length < 8 || !licenseKey || !discordUsername) {
            return json(res, 400, { error: "Username, password, discord username, and license key are required" });
          }

          let responsePayload = null;
          updateState((state) => {
            if (findUserByEmail(state, email)) {
              responsePayload = { status: 409, payload: { error: "Username is already registered" } };
              return state;
            }

            const license = state.licenseKeys.find((item) => item.keyHash === hashLicenseKey(licenseKey) && item.status === "active");
            if (!license) {
              responsePayload = { status: 400, payload: { error: "Invalid or already claimed license key" } };
              return state;
            }

            const user = {
              id: randomId(),
              email,
              passwordHash: createPasswordHash(password),
              displayName,
              discordUsername,
              role: "user",
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
            resolveScriptSession(state, user.id);
            addAuditLog(state, "auth.register", user.id, `Registered with license ${license.keyPreview}`);
            const token = createSessionToken(SESSION_SECRET, createSessionPayload(user.id));
            responsePayload = {
              status: 201,
              payload: { user: publicUser(user, state.licenseKeys) },
              headers: { "Set-Cookie": cookieHeader(token) },
            };
            return state;
          });
          return json(res, responsePayload.status, responsePayload.payload, responsePayload.headers);
        }

        if (pathname === "/auth/login" && req.method === "POST") {
          const body = await readBody(req);
          const email = normalizeEmail(body.username || body.email);
          const password = String(body.password || "");
          const state = readState();
          const user = findUserByEmail(state, email);
          if (!user || !verifyPassword(password, user.passwordHash)) {
            return json(res, 401, { error: "Invalid username or password" });
          }
          if (user.isBanned) {
            return json(res, 403, { error: "This account has been banned" });
          }
          updateState((draft) => {
            const draftUser = draft.users.find((item) => item.id === user.id);
            draftUser.lastLoginAt = new Date().toISOString();
            draftUser.updatedAt = new Date().toISOString();
            resolveScriptSession(draft, draftUser.id);
            addAuditLog(draft, "auth.login", draftUser.id, `Signed in from ${req.headers["user-agent"] || "unknown client"}`);
            return draft;
          });
          const token = createSessionToken(SESSION_SECRET, createSessionPayload(user.id));
          return json(
            res,
            200,
            { user: publicUser(readState().users.find((item) => item.id === user.id), readState().licenseKeys) },
            { "Set-Cookie": cookieHeader(token) },
          );
        }

        if (pathname === "/auth/check-license" && req.method === "POST") {
          const body = await readBody(req);
          const licenseKey = String(body.licenseKey || "").trim().toUpperCase();
          if (!licenseKey) {
            return json(res, 400, { error: "License key is required" });
          }
          const state = readState();
          const license = state.licenseKeys.find((item) => item.keyHash === hashLicenseKey(licenseKey));
          if (!license) {
            return json(res, 404, { error: "Invalid license key" });
          }
          if (license.status === "active" || !license.claimedByUserId) {
            // License is not registered yet
            return json(res, 200, { registered: false });
          }
          // License is registered, get the username
          const user = state.users.find((item) => item.id === license.claimedByUserId);
          return json(res, 200, { 
            registered: true, 
            username: user?.email || user?.displayName || "" 
          });
        }

        if (pathname === "/auth/logout" && req.method === "POST") {
          return json(res, 200, { ok: true }, { "Set-Cookie": clearCookieHeader() });
        }

        if (pathname === "/auth/me" && req.method === "GET") {
          const state = readState();
          const user = ensureUser(req, res, state);
          if (!user) return;
          return json(res, 200, buildHomePayload(state, user));
        }

        if (pathname === "/auth/forgot-password" && req.method === "POST") {
          const body = await readBody(req);
          const email = normalizeEmail(body.username || body.email);
          updateState((state) => {
            const user = findUserByEmail(state, email);
            if (user) {
              state.passwordResets.unshift({
                id: randomId(),
                userId: user.id,
                token: randomId(24),
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
              });
              state.passwordResets = state.passwordResets.slice(0, 50);
              addAuditLog(state, "auth.password_reset.requested", user.id, "Password reset requested");
            }
            return state;
          });
          return json(res, 200, { ok: true });
        }

        if (pathname === "/auth/reset-password" && req.method === "POST") {
          const body = await readBody(req);
          const resetToken = String(body.resetToken || "");
          const newPassword = String(body.newPassword || "");
          if (!resetToken || newPassword.length < 8) {
            return json(res, 400, { error: "Reset token and a stronger password are required" });
          }
          let payload = null;
          updateState((state) => {
            const reset = state.passwordResets.find((item) => item.token === resetToken);
            if (!reset || new Date(reset.expiresAt).getTime() < Date.now()) {
              payload = { status: 400, body: { error: "Reset token is invalid or expired" } };
              return state;
            }
            const user = state.users.find((item) => item.id === reset.userId);
            user.passwordHash = createPasswordHash(newPassword);
            user.updatedAt = new Date().toISOString();
            state.passwordResets = state.passwordResets.filter((item) => item.id !== reset.id);
            addAuditLog(state, "auth.password_reset.completed", user.id, "Password reset completed");
            payload = { status: 200, body: { ok: true } };
            return state;
          });
          return json(res, payload.status, payload.body);
        }

        if (pathname === "/home" && req.method === "GET") {
          const state = readState();
          const user = ensureUser(req, res, state);
          if (!user) return;
          return json(res, 200, buildHomePayload(state, user));
        }

        if (pathname === "/configs" && req.method === "GET") {
          const state = readState();
          const user = ensureUser(req, res, state);
          if (!user) return;
          const allConfigs = listVisibleConfigs(state, user);
          const myConfigs = allConfigs.filter((config) => config.ownerId === user.id);
          const marketplace = allConfigs.filter((config) => config.isPublished && (config.visibility === "public" || config.ownerId === user.id));
          const purchases = state.purchases.filter((item) => item.buyerId === user.id);
          return json(res, 200, { myConfigs, marketplace, purchases });
        }

        if (pathname === "/configs" && req.method === "POST") {
          const body = await readBody(req);
          const state = readState();
          const user = ensureUser(req, res, state);
          if (!user) return;
          if (!body.name || !body.luaContent) {
            return json(res, 400, { error: "Config name and Lua content are required" });
          }
          let createdConfig = null;
          updateState((draft) => {
            const config = {
              id: randomId(),
              ownerId: user.id,
              name: String(body.name).trim(),
              tier: body.tier || "Legit",
              description: String(body.description || ""),
              luaContent: String(body.luaContent || ""),
              isActive: draft.configs.filter((item) => item.ownerId === user.id).length === 0,
              visibility: body.visibility || "private",
              price: Number(body.price || 0),
              isPublished: Boolean(body.isPublished),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            draft.configs.push(config);
            addAuditLog(draft, "config.created", user.id, `Created config ${config.name}`);
            createdConfig = config;
            return draft;
          });
          return json(res, 201, {
            config: sanitizeConfig(
              createdConfig,
              user,
              null,
              resolveLicenseKeyValue(state.licenseKeys, user.licenseKeyId),
            ),
          });
        }

        if (pathname === "/configs/activate" && req.method === "POST") {
          const body = await readBody(req);
          let payload = null;
          updateState((state) => {
            const user = ensureUser(req, res, state);
            if (!user) {
              payload = "handled";
              return state;
            }
            const target = state.configs.find((item) => item.id === body.configId && item.ownerId === user.id);
            if (!target) {
              payload = { status: 404, body: { error: "Config not found" } };
              return state;
            }
            state.configs.forEach((item) => {
              if (item.ownerId === user.id) {
                item.isActive = item.id === target.id;
                item.updatedAt = new Date().toISOString();
              }
            });
            addAuditLog(state, "config.activated", user.id, `Activated config ${target.name}`);
            payload = { status: 200, body: { ok: true } };
            return state;
          });
          if (payload === "handled") return;
          return json(res, payload.status, payload.body);
        }

        if (pathname.startsWith("/configs/") && req.method === "PUT") {
          const configId = pathname.split("/")[2];
          const body = await readBody(req);
          let result = null;
          updateState((state) => {
            const user = ensureUser(req, res, state);
            if (!user) {
              result = "handled";
              return state;
            }
            const config = state.configs.find((item) => item.id === configId);
            if (!config || config.ownerId !== user.id) {
              result = { status: 404, body: { error: "Config not found" } };
              return state;
            }
            Object.assign(config, {
              name: body.name ?? config.name,
              tier: body.tier ?? config.tier,
              description: body.description ?? config.description,
              luaContent: body.luaContent ?? config.luaContent,
              visibility: body.visibility ?? config.visibility,
              price: body.price ?? config.price,
              isPublished: body.isPublished ?? config.isPublished,
              updatedAt: new Date().toISOString(),
            });
            if (body.isActive === true) {
              state.configs.forEach((item) => {
                if (item.ownerId === user.id) item.isActive = item.id === config.id;
              });
            }
            addAuditLog(state, "config.updated", user.id, `Updated config ${config.name}`);
            result = {
              status: 200,
              body: {
                config: sanitizeConfig(
                  config,
                  user,
                  null,
                  resolveLicenseKeyValue(state.licenseKeys, user.licenseKeyId),
                ),
              },
            };
            return state;
          });
          if (result === "handled") return;
          return json(res, result.status, result.body);
        }

        if (pathname.startsWith("/configs/") && req.method === "DELETE") {
          const configId = pathname.split("/")[2];
          let payload = null;
          updateState((state) => {
            const user = ensureUser(req, res, state);
            if (!user) {
              payload = "handled";
              return state;
            }
            const config = state.configs.find((item) => item.id === configId);
            if (!config || config.ownerId !== user.id) {
              payload = { status: 404, body: { error: "Config not found" } };
              return state;
            }
            state.configs = state.configs.filter((item) => item.id !== configId);
            addAuditLog(state, "config.deleted", user.id, `Deleted config ${config.name}`);
            payload = { status: 200, body: { ok: true } };
            return state;
          });
          if (payload === "handled") return;
          return json(res, payload.status, payload.body);
        }

        if (pathname === "/marketplace/purchase" && req.method === "POST") {
          const body = await readBody(req);
          let payload = null;
          updateState((state) => {
            const user = ensureUser(req, res, state);
            if (!user) {
              payload = "handled";
              return state;
            }
            const config = state.configs.find((item) => item.id === body.configId && item.isPublished);
            if (!config) {
              payload = { status: 404, body: { error: "Listing not found" } };
              return state;
            }
            const alreadyOwned = state.purchases.some((item) => item.buyerId === user.id && item.configId === config.id);
            if (!alreadyOwned && config.ownerId !== user.id) {
              state.purchases.push({
                id: randomId(),
                buyerId: user.id,
                configId: config.id,
                configName: config.name,
                sellerId: config.ownerId,
                pricePaid: config.price,
                purchasedAt: new Date().toISOString(),
              });
            }
            addAuditLog(state, "marketplace.purchase", user.id, `Purchased config ${config.name}`);
            payload = { status: 200, body: { ok: true } };
            return state;
          });
          if (payload === "handled") return;
          return json(res, payload.status, payload.body);
        }

        if (pathname === "/admin/overview" && req.method === "GET") {
          const state = readState();
          const user = ensureAdmin(req, res, state);
          if (!user) return;
          return json(res, 200, {
            users: state.users.map((item) => publicUser(item, state.licenseKeys)),
            licenseKeys: state.licenseKeys.map(sanitizeLicenseKey),
            configs: state.configs.map((config) => {
              const owner = state.users.find((item) => item.id === config.ownerId);
              return sanitizeConfig(config, owner);
            }),
            purchases: state.purchases,
            auditLogs: state.auditLogs,
            panelDefaults: sanitizePanelDefaults(state.panelDefaults),
          });
        }

        if (pathname === "/admin/panel-defaults" && req.method === "PUT") {
          const body = await readBody(req);
          let payload = null;
          updateState((state) => {
            const user = ensureAdmin(req, res, state);
            if (!user) {
              payload = "handled";
              return state;
            }

            const dashboardTitle = String(body.dashboardTitle || "").trim();
            const dashboardTier = String(body.dashboardTier || "").trim();
            const dashboardLuaContent = String(body.dashboardLuaContent || "");
            const dashboardDescription = String(body.dashboardDescription || "").trim();

            if (!dashboardTitle || !dashboardTier || !dashboardLuaContent.trim()) {
              payload = { status: 400, body: { error: "Title, tier, and Lua table content are required" } };
              return state;
            }

            state.panelDefaults = {
              dashboardTitle,
              dashboardTier,
              dashboardDescription,
              dashboardLuaContent,
              updatedAt: new Date().toISOString(),
              updatedBy: user.id,
            };

            addAuditLog(state, "admin.panel_defaults.updated", user.id, `Updated dashboard table ${dashboardTitle}`);
            payload = { status: 200, body: { panelDefaults: sanitizePanelDefaults(state.panelDefaults) } };
            return state;
          });
          if (payload === "handled") return;
          return json(res, payload.status, payload.body);
        }

        if (pathname === "/admin/license-keys" && req.method === "POST") {
          const body = await readBody(req);
          let payload = null;
          updateState((state) => {
            const user = ensureAdmin(req, res, state);
            if (!user) {
              payload = "handled";
              return state;
            }
            const rawKey = String(body.key || "").trim().toUpperCase();
            if (!rawKey) {
              payload = { status: 400, body: { error: "License key is required" } };
              return state;
            }
            if (state.licenseKeys.some((item) => item.keyHash === hashLicenseKey(rawKey))) {
              payload = { status: 409, body: { error: "That license key already exists" } };
              return state;
            }
            const record = {
              id: randomId(),
              keyPreview: rawKey,
              keyHash: hashLicenseKey(rawKey),
              status: "active",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: user.id,
              note: String(body.note || ""),
              claimedByUserId: null,
              claimedAt: null,
              expiresAt: body.expiresAt || null,
            };
            state.licenseKeys.unshift(record);
            addAuditLog(state, "license.created", user.id, `Created license ${rawKey}`);
            payload = { status: 201, body: { licenseKey: sanitizeLicenseKey(record) } };
            return state;
          });
          if (payload === "handled") return;
          return json(res, payload.status, payload.body);
        }

        if (pathname.startsWith("/admin/users/") && req.method === "PUT") {
          const targetUserId = pathname.split("/")[3];
          const body = await readBody(req);
          let payload = null;
          updateState((state) => {
            const user = ensureAdmin(req, res, state);
            if (!user) {
              payload = "handled";
              return state;
            }
            const target = state.users.find((item) => item.id === targetUserId);
            if (!target) {
              payload = { status: 404, body: { error: "User not found" } };
              return state;
            }
            if (typeof body.isBanned === "boolean") {
              target.isBanned = body.isBanned;
            }
            if (body.role === "admin" || body.role === "user") {
              target.role = body.role;
            }
            target.updatedAt = new Date().toISOString();
            addAuditLog(state, "admin.user.updated", user.id, `Updated user ${target.email}`);
            payload = { status: 200, body: { user: publicUser(target, state.licenseKeys) } };
            return state;
          });
          if (payload === "handled") return;
          return json(res, payload.status, payload.body);
        }

        if (pathname.startsWith("/admin/configs/") && req.method === "PUT") {
          const targetConfigId = pathname.split("/")[3];
          const body = await readBody(req);
          let payload = null;
          updateState((state) => {
            const user = ensureAdmin(req, res, state);
            if (!user) {
              payload = "handled";
              return state;
            }
            const config = state.configs.find((item) => item.id === targetConfigId);
            if (!config) {
              payload = { status: 404, body: { error: "Config not found" } };
              return state;
            }
            if (typeof body.isPublished === "boolean") config.isPublished = body.isPublished;
            if (body.visibility === "public" || body.visibility === "private" || body.visibility === "premium") {
              config.visibility = body.visibility;
            }
            if (typeof body.price === "number") config.price = body.price;
            config.updatedAt = new Date().toISOString();
            addAuditLog(state, "admin.config.updated", user.id, `Moderated config ${config.name}`);
            payload = { status: 200, body: { config } };
            return state;
          });
          if (payload === "handled") return;
          return json(res, payload.status, payload.body);
        }

        if (pathname === "/script/heartbeat" && (req.method === "POST" || req.method === "GET")) {
          const body =
            req.method === "POST"
              ? await readBody(req)
              : {
                  licenseKey: url.searchParams.get("licenseKey") || url.searchParams.get("license"),
                  game: url.searchParams.get("game"),
                  executor: url.searchParams.get("executor"),
                  version: url.searchParams.get("version"),
                };
          const licenseKey = String(body.licenseKey || req.headers["x-luxx-license"] || "").trim().toUpperCase();
          if (!licenseKey) {
            return json(res, 400, { error: "License key is required" });
          }
          let payload = null;
          updateState((state) => {
            const license = state.licenseKeys.find((item) => item.keyHash === hashLicenseKey(licenseKey));
            if (!license || !license.claimedByUserId) {
              payload = { status: 403, body: { error: "License is not linked to a user account" } };
              return state;
            }
            const user = state.users.find((item) => item.id === license.claimedByUserId);
            if (!user || user.isBanned) {
              payload = { status: 403, body: { error: "Account is unavailable" } };
              return state;
            }
            const session = resolveScriptSession(state, user.id);
            session.online = true;
            session.game = body.game || "Game Found";
            session.executor = body.executor || "Unknown Executor";
            session.version = body.version || null;
            session.lastSeenAt = new Date().toISOString();
            session.updatedAt = new Date().toISOString();
            const activeConfig = state.configs.find((item) => item.ownerId === user.id && item.isActive) || null;
            payload = {
              status: 200,
              body: {
                ok: true,
                userId: user.id,
                activeConfigId: activeConfig?.id || null,
                activeConfigName: activeConfig?.name || null,
                activeConfigUpdatedAt: activeConfig?.updatedAt || null,
                activeConfigLua: injectLicenseIntoLua(activeConfig?.luaContent || null, licenseKey),
                activeConfig: activeConfig ? sanitizeConfig(activeConfig, user, session, licenseKey) : null,
                canOpenPanel: Boolean(activeConfig),
              },
            };
            return state;
          });
          return json(res, payload.status, payload.body);
        }

        if (pathname === "/script/loader" && req.method === "GET") {
          const licenseKey = String(url.searchParams.get("license") || url.searchParams.get("licenseKey") || "").trim().toUpperCase();
          if (!licenseKey) {
            return json(res, 400, { error: "License key is required" });
          }

          const state = readState();
          const license = state.licenseKeys.find((item) => item.keyHash === hashLicenseKey(licenseKey));
          if (!license || !license.claimedByUserId) {
            return json(res, 403, { error: "License is not linked to a user account" });
          }

          const user = state.users.find((item) => item.id === license.claimedByUserId);
          if (!user || user.isBanned) {
            return json(res, 403, { error: "Account is unavailable" });
          }

          const loaderScript = readBundledLuxxLoaderScript();
          if (!loaderScript) {
            return json(res, 500, { error: "Bundled loader script is unavailable" });
          }

          return text(res, 200, injectLicenseIntoLua(loaderScript, licenseKey), {
            "Cache-Control": "no-store",
          });
        }

        if (pathname === "/script/status" && req.method === "GET") {
          const state = readState();
          const user = ensureUser(req, res, state);
          if (!user) return;
          const session = resolveScriptSession(state, user.id);
          return json(res, 200, {
            online: Boolean(session.online),
            game: session.game,
            executor: session.executor,
            lastSeenAt: session.lastSeenAt,
            sessionCode: session.sessionCode,
          });
        }

        return notFound(res);
      });
    },
  };
}
