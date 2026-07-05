CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','user')),
  is_banned INTEGER NOT NULL DEFAULT 0,
  license_key_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS license_keys (
  id TEXT PRIMARY KEY,
  key_preview TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','used','revoked')),
  created_by TEXT,
  note TEXT,
  claimed_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  claimed_at TEXT,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS configs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  tier TEXT NOT NULL,
  description TEXT,
  lua_content TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  visibility TEXT NOT NULL CHECK (visibility IN ('private','public')),
  price INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL
);
