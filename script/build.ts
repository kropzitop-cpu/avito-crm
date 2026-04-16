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

  // Fix index.html for Railway: remove type="module" and crossorigin (breaks some environments)
  // Move script tags to end of body so React can find #root
  const distDir = "dist/public";
  const htmlPath = `${distDir}/index.html`;
  let html = await readFile(htmlPath, "utf-8");

  // Remove type="module" and crossorigin attributes
  html = html.replace(/ type="module"/g, "").replace(/ crossorigin/g, "");

  // Move all <script ...> tags from <head> to end of <body>
  const scriptTagsInHead: string[] = [];
  // Extract script tags that are in head (before <body>)
  const bodyIdx = html.indexOf('<body>');
  if (bodyIdx > -1) {
    let head = html.substring(0, bodyIdx);
    const body = html.substring(bodyIdx);
    head = head.replace(/<script[^>]*src="[^"]+"[^>]*><\/script>/g, (match) => {
      scriptTagsInHead.push(match);
      return '';
    });
    if (scriptTagsInHead.length > 0) {
      html = head + body.replace('</body>', scriptTagsInHead.join('\n') + '\n</body>');
    } else {
      html = head + body;
    }
  }

  await writeFile(htmlPath, html, "utf-8");
  console.log("patched index.html (moved scripts to body, removed type=module)");

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
