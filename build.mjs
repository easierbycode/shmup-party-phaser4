// Build the Phaser Editor TypeScript project into a static, runnable bundle that
// the CMG Launcher (and any plain static host) can serve directly.
//
// The source can't be served raw: index.html loads `./src/_main.ts` as a module
// and the source imports other `.ts` files, which browsers can't execute. This
// bundles `src/_main.ts` into a single `dist/game.js`, copies the assets + the
// minified Phaser runtime next to a generated `dist/index.html`, and zips it all
// up as `shmup-party-phaser4.zip` (index.html at the zip root).
//
// `Phaser` is a runtime global (loaded via phaser.js), not an npm import, so it
// stays an undefined free variable in the bundle and resolves at run time.

import * as esbuild from "esbuild";
import { execSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = resolve(root, "dist");
const zipPath = resolve(root, "shmup-party-phaser4.zip");

// The source pins the asset base to the absolute "/assets/", which only works
// when the game is served from the origin root. Under a subpath (the launcher
// serves it from /cmg-net/<id>/) it must be relative so it resolves against
// index.html. Rewrite it at bundle time via an onLoad hook so the result is
// correct regardless of minification.
const relativeAssetBase = {
  name: "relative-asset-base",
  setup(build) {
    build.onLoad({ filter: /[/\\]_main\.ts$/ }, (args) => {
      let contents = readFileSync(args.path, "utf8");
      const before = contents;
      contents = contents.replace(
        'this.load.baseURL = "/assets/";',
        'this.load.baseURL = "assets/";',
      );
      if (contents === before) {
        console.warn(
          '[build] WARNING: did not find absolute `this.load.baseURL = "/assets/"` to rewrite',
        );
      }
      return { contents, loader: "ts" };
    });
  },
};

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await esbuild.build({
  entryPoints: [resolve(root, "src/_main.ts")],
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: true,
  outfile: resolve(dist, "game.js"),
  plugins: [relativeAssetBase],
  logLevel: "info",
});

// Runtime assets + the minified Phaser 4.1.0 runtime (1.3 MB, vs the 8 MB
// unminified _phaser.js) sit next to index.html.
cpSync(resolve(root, "assets"), resolve(dist, "assets"), { recursive: true });
cpSync(resolve(root, "phaser.js"), resolve(dist, "phaser.js"));

// A static index.html that boots the prebuilt bundle (mirrors the original page
// shell — same body styles, #game-container, hidden cursor, safe-area padding).
const indexHtml = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sh'M↑ Party</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400..900&display=swap" rel="stylesheet">
    <style>
        body {
            -webkit-touch-callout: none;
            -webkit-text-size-adjust: none;
            -webkit-user-select: none;
            font-family: 'Orbitron', system-ui, -apple-system, -apple-system-font, 'Segoe UI', 'Roboto', sans-serif;
            font-size: 12px;
            height: 100vh;
            margin: 0px;
            padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-right, 0px);
            width: 100%;
            background: #000;
            cursor: none;
            overflow: hidden;
        }
    </style>
</head>

<body>
    <div id="game-container"></div>
    <!-- Phaser 4.1.0 (minified) -->
    <script src="./phaser.js"></script>
    <!-- Prebuilt game bundle (esbuild, from src/_main.ts) -->
    <script src="./game.js"></script>
</body>

</html>
`;
writeFileSync(resolve(dist, "index.html"), indexHtml);

// Flat zip with index.html at the root, so the launcher caches files at clean
// paths (/cmg-net/<id>/index.html, /cmg-net/<id>/assets/...).
rmSync(zipPath, { force: true });
execSync("zip -qr ../shmup-party-phaser4.zip .", { cwd: dist, stdio: "inherit" });

console.log("[build] wrote dist/ and shmup-party-phaser4.zip");
