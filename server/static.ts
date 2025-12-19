import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // In production, the bundled server runs from dist/index.cjs
  // Client assets are in dist/public/
  // Use process.cwd() as the primary method since __dirname may not work correctly in bundled ESM/CJS
  const cwd = process.cwd();
  
  // Try multiple possible paths for the static files
  const possiblePaths = [
    path.join(cwd, "dist", "public"),           // Standard: project_root/dist/public
    path.join(cwd, "public"),                    // If running from dist/
    path.resolve(__dirname, "public"),           // Relative to script location
    path.resolve(__dirname, "..", "public"),     // One level up
  ];
  
  let staticPath: string | null = null;
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p) && fs.existsSync(path.join(p, "index.html"))) {
        staticPath = p;
        console.log(`[static] Serving files from: ${p}`);
        break;
      }
    } catch (e) {
      // Skip paths that can't be accessed
    }
  }
  
  if (!staticPath) {
    console.error(`[static] Could not find build directory. Checked paths:`, possiblePaths);
    throw new Error(
      `Could not find the build directory with index.html. Make sure to run 'npm run build' first.`,
    );
  }

  app.use(express.static(staticPath));

  // fall through to index.html if the file doesn't exist (SPA routing)
  app.use("*", (_req, res) => {
    res.sendFile(path.join(staticPath!, "index.html"));
  });
}
