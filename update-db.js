
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the default config
const defaultConfigPath = path.join(__dirname, 'default-luxx-config.lua');
const defaultConfigContent = fs.readFileSync(defaultConfigPath, 'utf8');

// Read current DB
const dbPath = path.join(__dirname, '.data', 'luxx-db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Update panelDefaults and configs
db.panelDefaults.dashboardLuaContent = defaultConfigContent;
if (db.configs.length > 0) {
  db.configs[0].luaContent = defaultConfigContent;
}

// Write back DB
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

console.log('Database updated with new config!');
