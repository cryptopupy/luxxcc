# Luxx Web

Local Luxx web panel with:

- Secure email/password authentication with salted PBKDF2 hashing
- Signed `HttpOnly` session cookies
- Admin-created license keys required for registration
- Config dashboard, marketplace, and admin moderation panel
- Local script heartbeat endpoints used by `luxx.lua` live sync

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm run dev
```

3. Open the local Vite URL, usually `http://localhost:5173`.

The Vite dev server now hosts both the frontend and the local API.

## Seed credentials

- Admin login: `admin`
- Admin password: `admin`
- Starter license key: `adminkey1234`

Data is stored in `./.data/luxx-db.json`.

## API notes

Current local endpoints include:

- `/api/auth/register`
- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/me`
- `/api/auth/forgot-password`
- `/api/auth/reset-password`
- `/api/home`
- `/api/configs`
- `/api/configs/activate`
- `/api/marketplace/purchase`
- `/api/admin/overview`
- `/api/admin/license-keys`
- `/api/admin/users/:id`
- `/api/admin/configs/:id`
- `/api/script/heartbeat`
- `/api/script/status`

## Live sync

- `luxx.lua` polls `http://127.0.0.1:5173/api/script/heartbeat`
- It sends the license key from `shared.luxxcc.Globals.Key`
- The dashboard `Apply` button saves the active config, and the Lua script pulls the updated config automatically on the next poll
