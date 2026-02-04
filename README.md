# hyrox-531-app

Mobile-friendly HYROX + 5/3/1 dashboard. Zero server. Deploys on GitHub Pages.

## Deploy (no local install)
1. Create a public repo named **hyrox-531-app** on GitHub.
2. Upload these files/folders to the repo root:
   - `/index.html`
   - `/src/main.jsx`
   - `/src/App.jsx`
   - `/package.json`
   - `/vite.config.js`
   - `/.github/workflows/deploy.yml`
3. Go to **Settings → Pages → Source = GitHub Actions**.
4. Push/commit to **main** and wait for the **Deploy to GitHub Pages** workflow to finish.
5. Your app URL will be:
   `https://<username>.github.io/hyrox-531-app/`

### Important (Vite base path)
If you use a *different* repo name, edit `vite.config.js` and set:

```js
export default defineConfig({
  base: '/<YOUR-REPO-NAME>/',
})
```

---

## Credits & Docs
- Vite static deploy & base path guidance (GitHub Pages): see Vite docs (Static Deploy, GitHub Pages) and examples using GitHub Actions.
