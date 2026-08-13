# Free deploy — Vercel + Neon

## What the build error meant

```
Could not load --schema from provided path packages/database/prisma/schema.prisma:
file or directory not found
```

The schema **is** in the GitHub repo. Vercel could not see it because the build ran from the **wrong folder** — usually when **Root Directory** is set to `apps/web` instead of the **repository root**.

### Fix in Vercel (important)

1. Project → **Settings → General**
2. **Root Directory** → click Edit → leave it **empty** / `.` (repo root)
3. Save → **Deployments → Redeploy** (or push a new commit)

Do **not** set Root Directory to `apps/web`.

---

## Full setup

### 1. Neon (free Postgres)

1. [neon.tech](https://neon.tech) → sign up → create project
2. Copy `DATABASE_URL`

### 2. Vercel

1. [vercel.com](https://vercel.com) → import `nysc-ekiti-digital-platform`
2. **Root Directory: empty (repo root)**
3. Env vars:

| Name | Value |
|------|--------|
| `DATABASE_URL` | Neon connection string |
| `JWT_ACCESS_SECRET` | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | another random 32+ char string |
| `APP_URL` | `https://your-app.vercel.app` (set after first deploy) |
| `SEED_SUPER_ADMIN_EMAIL` | your email |
| `SEED_SUPER_ADMIN_PASSWORD` | strong password |

4. Deploy

### 3. Create tables once (from your laptop)

```bash
git clone https://github.com/Diosnr/nysc-ekiti-digital-platform.git
cd nysc-ekiti-digital-platform
cp .env.example .env
# put same DATABASE_URL + JWT secrets in .env
npm install
npx prisma db push --schema=packages/database/prisma/schema.prisma
npm run db:seed
```

### 4. Test

- `https://YOUR-APP.vercel.app/pcm` — paste the NYSC verify URL or scan QR
- `https://YOUR-APP.vercel.app/staff/login` — staff login

You do **not** need a local run to use Vercel, but you **do** need step 3 once so Neon has tables + Super Admin.
