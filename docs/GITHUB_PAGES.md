# Viewing the public site on GitHub Pages

The public website (`apps/web`) is configured for **static export** and automatic deploy to GitHub Pages.

## Site URL (after setup)

**https://diosnr.github.io/nysc-ekiti-digital-platform/**

## Requirements

1. **Repository must be public** (GitHub Free), **or** you need GitHub Pro/Team for private Pages.
2. GitHub Pages must be enabled with source **GitHub Actions**.

## One-time setup (do this in the GitHub UI)

1. Open the repository: https://github.com/Diosnr/nysc-ekiti-digital-platform
2. If the repo is still **private** and you are on Free:
   - **Settings → General → Danger Zone → Change visibility → Public**
3. Enable Pages:
   - **Settings → Pages**
   - Under **Build and deployment → Source**, choose **GitHub Actions**
4. Trigger a deploy:
   - Push to `main`, or
   - **Actions → "Deploy public site to GitHub Pages" → Run workflow**

After the workflow succeeds (usually 1–3 minutes), open:

https://diosnr.github.io/nysc-ekiti-digital-platform/

## Local static build (optional)

```bash
cd apps/web
npm install
GITHUB_PAGES=true npm run build:pages
# Static files are in apps/web/out/
```

## Notes

- `basePath` is set only when `GITHUB_PAGES=true`, so local `npm run dev` still runs at `http://localhost:3000/`.
- This deploy is for the **public institutional website only**. Internal ops, auth, and APIs are not part of the static export.
- Later production hosting (Vercel, custom domain, Node server) can replace or sit alongside Pages.
