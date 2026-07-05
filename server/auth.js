import crypto from "node:crypto";

const ITERATIONS = 120000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export function randomId(size = 16) {
  return crypto.randomBytes(size).toString("hex");
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function hashLicenseKey(key) {
  return crypto.createHash("sha256").update(String(key || "").trim().toUpperCase()).digest("hex");
}

export function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return `${ITERATIONS}:${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const [iterationsText, salt, originalHash] = storedHash.split(":");
  const iterations = Number(iterationsText);
  if (!iterations || !salt || !originalHash) return false;
  const computedHash = crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, DIGEST).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(originalHash, "hex"), Buffer.from(computedHash, "hex"));
}

export function createSessionToken(secret, payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifySessionToken(secret, token) {
  if (!token || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (!payload.expiresAt || payload.expiresAt < Date.now()) {
    return null;
  }
  return payload;
}

export function createSessionPayload(userId) {
  return {
    userId,
    sessionId: randomId(24),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
}

export function cookieHeader(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `luxx_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`;
}

export function clearCookieHeader() {
  return "luxx_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}
