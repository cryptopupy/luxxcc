import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPasswordHash,
  hashLicenseKey,
  normalizeEmail,
  randomId,
  verifyPassword,
} from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", ".data");
const dataFile = path.join(dataDir, "luxx-db.json");
const bundledLuxxConfigPath = path.join(__dirname, "..", "default-luxx-config.lua");
const bundledLuxxLoaderPath = path.join(__dirname, "..", "..", "luxx.lua");
const configKeyPattern = /(\['Key'\]\s*=\s*)([^,\r\n]+)(,?)/;

const nowIso = () => new Date().toISOString();

function readBundledLuxxConfig() {
  try {
    return fs.readFileSync(bundledLuxxConfigPath, "utf8");
  } catch {
    return `shared.luxxcc = {
  ["Globals"] = {
    ["Key"] = "YOUR-KEY-HERE"
  }
}`;
  }
}

export function readBundledLuxxLoaderScript() {
  try {
    return fs.readFileSync(bundledLuxxLoaderPath, "utf8");
  } catch {
    return null;
  }
}

function ensureDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function createLicenseRecord({ key, createdBy = "system", note = "Seeded key" }) {
  return {
    id: randomId(),
    keyPreview: key,
    keyHash: hashLicenseKey(key),
    status: "active",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    createdBy,
    note,
    claimedByUserId: null,
    claimedAt: null,
    expiresAt: null,
  };
}

function createInitialState() {
  const adminId = randomId();
  const adminLicense = createLicenseRecord({
    key: "ADMIN-INTERNAL-KEY",
    note: "Seed license for the administrator",
  });
  const starterLicense = createLicenseRecord({
    key: "adminkey1234",
    note: "Starter registration key",
  });
  const defaultDashboardLua = readBundledLuxxConfig();

  return {
    meta: {
      createdAt: nowIso(),
      updatedAt: nowIso(),
      scriptPollingWindowMs: 90000,
    },
    panelDefaults: {
      dashboardTitle: "LUXX",
      dashboardTier: "Custom",
      dashboardDescription: "Bundled LUXX config synced from luxx.lua.",
      dashboardLuaContent: defaultDashboardLua,
      updatedAt: nowIso(),
      updatedBy: adminId,
    },
    users: [
      {
        id: adminId,
        email: "admin",
        passwordHash: createPasswordHash("admin"),
        displayName: "Luxx Admin",
        role: "admin",
        isBanned: false,
        licenseKeyId: adminLicense.id,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        lastLoginAt: null,
      },
    ],
    licenseKeys: [
      {
        ...adminLicense,
        status: "used",
        claimedByUserId: adminId,
        claimedAt: nowIso(),
      },
      starterLicense,
    ],
    configs: [
      {
        id: randomId(),
        ownerId: adminId,
        name: "Luxx Default",
        tier: "Custom",
        description: "Bundled LUXX config synced from luxx.lua.",
        luaContent: defaultDashboardLua,
        isActive: true,
        visibility: "private",
        price: 0,
        isPublished: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ],
    purchases: [],
    scriptSessions: [],
    auditLogs: [
      {
        id: randomId(),
        actorUserId: adminId,
        action: "seed.admin.created",
        details: "Seeded admin account and initial license set",
        createdAt: nowIso(),
      },
    ],
    passwordResets: [],
  };
}

function migrateState(state) {
  let changed = false;
  const adminUser = state.users.find((user) => user.role === "admin");
  const bundledLuxxConfig = readBundledLuxxConfig();

  if (adminUser && adminUser.email === "admin@luxx.local") {
    adminUser.email = "admin";
    adminUser.updatedAt = nowIso();
    changed = true;
  }

  if (adminUser && verifyPassword("ChangeMe123!", adminUser.passwordHash)) {
    adminUser.passwordHash = createPasswordHash("admin");
    adminUser.updatedAt = nowIso();
    changed = true;
  }

  const starterKey = state.licenseKeys.find((key) => key.keyPreview.toLowerCase() === "adminkey1234");
  if (!starterKey) {
    state.licenseKeys.push(
      createLicenseRecord({
        key: "adminkey1234",
        note: "Starter registration key",
      }),
    );
    changed = true;
  } else if (starterKey.claimedByUserId) {
    state.licenseKeys.push(
      createLicenseRecord({
        key: "adminkey1234",
        note: "Starter registration key refresh",
      }),
    );
    changed = true;
  }

  if (!state.panelDefaults) {
    const adminConfig = state.configs.find((config) => config.ownerId === adminUser?.id) || state.configs[0] || null;
    state.panelDefaults = {
      dashboardTitle: adminConfig?.name || "Luxx Default",
      dashboardTier: adminConfig?.tier || "Custom",
      dashboardDescription: adminConfig?.description || "Bundled LUXX config synced from luxx.lua.",
      dashboardLuaContent: adminConfig?.luaContent || bundledLuxxConfig,
      updatedAt: nowIso(),
      updatedBy: adminUser?.id || "system",
    };
    changed = true;
  }

  if (
    state.panelDefaults?.dashboardTitle === "Hood Customs"
    || state.panelDefaults?.dashboardLuaContent?.includes('shared.luxx = {')
  ) {
    state.panelDefaults = {
      ...state.panelDefaults,
      dashboardTitle: "LUXX",
      dashboardTier: "Custom",
      dashboardDescription: "Bundled LUXX config synced from luxx.lua.",
      dashboardLuaContent: bundledLuxxConfig,
      updatedAt: nowIso(),
      updatedBy: adminUser?.id || state.panelDefaults?.updatedBy || "system",
    };
    changed = true;
  }

  const adminConfig = state.configs.find((config) => config.ownerId === adminUser?.id && config.isActive) || state.configs.find((config) => config.ownerId === adminUser?.id);
  if (
    adminConfig
    && (
      adminConfig.name === "Hood Customs"
      || adminConfig.luaContent?.includes('shared.luxx = {')
    )
  ) {
    adminConfig.name = "Luxx Default";
    adminConfig.tier = "Custom";
    adminConfig.description = "Bundled LUXX config synced from luxx.lua.";
    adminConfig.luaContent = bundledLuxxConfig;
    adminConfig.updatedAt = nowIso();
    changed = true;
  }

  // Removed: Don't reset user's config every time

  // Removed: Don't reset panel defaults every time

  return changed;
}

function writeState(state) {
  ensureDir();
  state.meta.updatedAt = nowIso();
  fs.writeFileSync(dataFile, JSON.stringify(state, null, 2));
}

export function readState() {
  ensureDir();
  if (!fs.existsSync(dataFile)) {
    const initialState = createInitialState();
    writeState(initialState);
    return initialState;
  }
  const state = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  if (migrateState(state)) {
    writeState(state);
  }
  return state;
}

export function updateState(mutator) {
  const state = readState();
  const result = mutator(state) ?? state;
  writeState(result);
  return result;
}

export function publicUser(user, licenseKeys = []) {
  if (!user) return null;
  const license = licenseKeys.find((item) => item.id === user.licenseKeyId);
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    isBanned: user.isBanned,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
    licenseKeyId: user.licenseKeyId,
    licenseKeyPreview: license?.keyPreview || null,
  };
}

export function resolveLicenseKeyValue(licenseKeys, licenseKeyId) {
  const license = licenseKeys.find((item) => item.id === licenseKeyId);
  return license?.keyPreview || null;
}

export function injectLicenseIntoLua(luaContent, licenseKey) {
  if (typeof luaContent !== "string" || !licenseKey) {
    return luaContent;
  }

  if (!configKeyPattern.test(luaContent)) {
    return luaContent;
  }

  return luaContent.replace(configKeyPattern, `$1"${licenseKey}"$3`);
}

export function sanitizeLicenseKey(record) {
  if (!record) return null;
  return {
    id: record.id,
    keyPreview: record.keyPreview,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    createdBy: record.createdBy,
    note: record.note,
    claimedByUserId: record.claimedByUserId,
    claimedAt: record.claimedAt,
    expiresAt: record.expiresAt,
  };
}

export function sanitizeConfig(config, owner = null, session = null, licenseKey = null) {
  const luaContent = injectLicenseIntoLua(config.luaContent, licenseKey);
  return {
    id: config.id,
    ownerId: config.ownerId,
    ownerName: owner?.displayName || owner?.email || "Unknown",
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

export function sanitizePanelDefaults(panelDefaults, licenseKey = null) {
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

export function addAuditLog(state, action, actorUserId, details) {
  state.auditLogs.unshift({
    id: randomId(),
    actorUserId,
    action,
    details,
    createdAt: nowIso(),
  });
  state.auditLogs = state.auditLogs.slice(0, 250);
}

export function findUserByEmail(state, email) {
  return state.users.find((user) => user.email === normalizeEmail(email));
}
