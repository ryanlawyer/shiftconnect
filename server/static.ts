import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // In production, server code runs from dist/, and client assets are in dist/public/
  // __dirname in production will be dist/, so we look for dist/public
  const distPath = path.resolve(__dirname, "public");
  
  // Fallback paths for different build configurations
  const fallbackPaths = [
    distPath,
    path.resolve(__dirname, "..", "dist", "public"),
    path.resolve(process.cwd(), "dist", "public"),
  ];
  
  let staticPath: string | null = null;
  for (const p of fallbackPaths) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, "index.html"))) {
      staticPath = p;
      break;
    }
  }
  
  if (!staticPath) {
    throw new Error(
      `Could not find the build directory with index.html. Checked: ${fallbackPaths.join(", ")}. Make sure to build the client first.`,
    );
  }

  app.use(express.static(staticPath));

  // fall through to index.html if the file doesn't exist (SPA routing)
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(staticPath!, "index.html"));
  });
}
