# Free deploy — Vercel + Neon (recommended)

Test the full app (QR intake, APIs, database) on a public HTTPS URL.

GitHub Pages stays for the static brochure only. **Use Vercel for the real app.**

---

## 1. Free Postgres (Neon) — ~2 minutes

1. Go to [https://neon.tech](https://neon.tech) → sign up (GitHub login is fine)
2. **Create a project** (region: closest to you, e.g. Frankfurt or Singapore)
3. Copy the **connection string** (starts with `postgresql://…`)
   - Prefer the one labeled **pooled** if Neon shows both

Keep it for step 3.

---

## 2. Deploy on Vercel — ~3 minutes

1. Go to [https://vercel.com](https://vercel.com) → sign up with **GitHub**
2. **Add New Project** → import `Diosnr/nysc-ekiti-digital-platform`
3. Settings (usually auto-detected):
   - Framework: **Next.js**
   - Root Directory: leave **empty** (repo root)
   - Build Command: leave default from `vercel.json` (or `npm run build`)
4. **Do not deploy yet** — first add Environment Variables (step 3)

---

## 3. Environment variables on Vercel

In the project → **Settings → Environment Variables**, add for **Production** (and Preview if you want):

| Name | Value |
|------|--------|
| `DATABASE_URL` | Neon connection string from step 1 |
| `JWT_ACCESS_SECRET` | long random string (≥32 chars) |
| `JWT_REFRESH_SECRET` | another long random string (≥32 chars) |
| `APP_URL` | your Vercel URL after first deploy, e.g. `https://nysc-ekiti-digital-platform.vercel.app` |
| `SEED_SUPER_ADMIN_EMAIL` | `admin@nysc-ekiti.local` (or your email) |
| `SEED_SUPER_ADMIN_PASSWORD` | a strong password you choose |

Generate secrets quickly:

```bash
openssl rand -hex 32
```

---

## 4. Deploy

Click **Deploy**. Wait for the build to finish.

---

## 5. Create database tables + Super Admin (one time)

On your laptop (with the same `DATABASE_URL`):

```bash
git clone https://github.com/Diosnr/nysc-ekiti-digital-platform.git
cd nysc-ekiti-digital-platform
cp .env.example .env
# paste DATABASE_URL and JWT secrets into .env

npm install
npx prisma db push --schema=packages/database/prisma/schema.prisma
npm run db:seed
```

Or from Vercel’s perspective: after deploy, run the same `db push` + `seed` once against Neon from your machine.

---

## 6. Test

| URL | What |
|-----|------|
| `https://YOUR-APP.vercel.app/pcm` | PCM self-service + live QR |
| Paste sample verify URL | Same as QR without camera |
| `https://YOUR-APP.vercel.app/staff/login` | Staff login |

Sample QR URL to paste on `/pcm`:

```
https://mgt.nysc.org.ng/verify/CorpMemberVerify.aspx?svc=callup&callup=ZqAFrmr1EWERlHFPZn7c21DJvvIiq54K8cRMFnQNwj0~
```

After success you should see a registered PCM (e.g. Okenwa Chinyere Maryjane / NYSC/EST/2026/256817).

---

## Railway alternative (also free trial)

If you prefer one dashboard for app + DB:

1. [railway.app](https://railway.app) → login with GitHub
2. **New Project** → **Deploy from GitHub repo**
3. **Add PostgreSQL** plugin → copy `DATABASE_URL` into the web service variables
4. Add the same JWT / APP_URL / seed env vars
5. Start command: `npm run start --workspace=@nysc/web`  
   Build: `npm run build`
6. Run `prisma db push` + seed once from your laptop against Railway’s `DATABASE_URL`

Vercel + Neon is usually fewer clicks for Next.js.

---

## Notes

- Camera QR needs **HTTPS** (Vercel provides that).
- Free Neon/Vercel tiers are enough for demos and stakeholder tests.
- Re-deploy happens automatically on every push to `main`.
