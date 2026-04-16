import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, writeFile } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  // Inline all JS/CSS into index.html so it works inside Perplexity CSP-restricted iframe
  const distDir = "dist/public";
  const htmlPath = `${distDir}/index.html`;
  let html = await readFile(htmlPath, "utf-8");
  // Find and inline JS files
  const jsMatch = html.match(/src="(\.\/assets\/[^"]+\.js)"/);
  if (jsMatch) {
    const jsContent = (await readFile(`${distDir}/${jsMatch[1].replace('./', '')}`, "utf-8"))
      // Escape </script> inside JS to prevent early tag closing
      .replace(/<\/script>/gi, '<\/script>');
    // Replace first script src tag with inlined content, remove all others
    html = html.replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/, `<script>${jsContent}<\/script>`);
    // Remove any remaining external script tags (duplicates from vite)
    html = html.replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/g, "");
  }
  // Find and inline CSS files
  const cssMatch = html.match(/href="(\.\/assets\/[^"]+\.css)"/);
  if (cssMatch) {
    const cssContent = await readFile(`${distDir}/${cssMatch[1].replace('./', '')}`, "utf-8");
    html = html.replace(/<link[^>]+rel="stylesheet"[^>]*href="[^"]+"[^>]*>/, `<style>${cssContent}<\/style>`);
  }
  // Remove remaining type="module" and crossorigin attrs
  html = html.replace(/ type="module"/g, "").replace(/ crossorigin/g, "");
  await writeFile(htmlPath, html, "utf-8");
  console.log("patched index.html (inlined JS/CSS for iframe CSP compatibility)");

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
