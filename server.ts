import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import aiRoutes from "./server/routes/ai";

// Process level safety handlers
process.on("unhandledRejection", (reason) => {
  console.error("[Unhandled Rejection]:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[Uncaught Exception]:", error);
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser with 10MB limit for document uploads
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // API Routes
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      app: "Supervisi Pembelajaran Mendalam AI",
      timestamp: new Date().toISOString(),
    });
  });

  // Mount secured AI & Document routes
  app.use("/api", aiRoutes);

  // Catch-all 404 handler for unmatched /api/* requests (returns JSON, never HTML)
  app.use("/api/*", (_req, res) => {
    res.status(404).json({
      success: false,
      error: "NOT_FOUND",
      message: "API endpoint tidak ditemukan.",
    });
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Fallback for SPA client-side routing in dev mode
    app.get("*", async (req, res, next) => {
      if (req.originalUrl.startsWith("/api")) {
        return next();
      }
      try {
        const indexPath = path.resolve(process.cwd(), "index.html");
        if (fs.existsSync(indexPath)) {
          let template = fs.readFileSync(indexPath, "utf-8");
          template = await vite.transformIndexHtml(req.originalUrl, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } else {
          next();
        }
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Express error handler for API errors (returns JSON, never HTML)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[Server Global Error]:", err);
    if (res.headersSent) return;
    res.status(500).json({
      success: false,
      error: "SERVER_ERROR",
      message: err?.message || "Terjadi kesalahan internal pada server.",
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Supervisi AI running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
