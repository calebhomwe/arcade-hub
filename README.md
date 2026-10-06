# Arcade Hub (Pocket Arcade)

38 single-file browser games (`games/*.html`) with shared kits in `games/kit/`, `games/kit3d/` and assets in `games/assets/`. They are also listed in [Caleb's Arcade](https://calebhomwe.github.io/arcade/).

## Play / Test

- **Play online:** https://calebhomwe.github.io/arcade-hub/ (GitHub Pages, deployed from `main`)
- **Run locally:** `python3 -m http.server 8080`, then open http://localhost:8080/
- **Smoke test** (loads the hub and every game in headless Chromium, fails on page errors or missing files; the `Smoke` workflow runs it on every push and PR):

  ```sh
  npm install --no-save --no-package-lock playwright@1.58.2 && npx playwright install chromium
  python3 -m http.server 8080 &
  node .github/smoke.mjs http://127.0.0.1:8080/ index.html games/*.html
  ```

`zall.html`, `zfun.html` and `ztest_harness.html` are in-browser test pages for the chess game, not part of the hub. `_loop/` holds the work notes and tooling of the improvement loop and is not linked from the site.
