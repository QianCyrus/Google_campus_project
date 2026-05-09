import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const publicDir = fileURLToPath(new URL("./public/", import.meta.url));
const port = Number.parseInt(process.env.PORT || "8080", 10);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

const securityHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff"
};

async function startExpressServer() {
  try {
    const { default: express } = await import("express");
    const app = express();

    app.use((_req, res, next) => {
      for (const [key, value] of Object.entries(securityHeaders)) {
        res.setHeader(key, value);
      }
      next();
    });

    app.use(express.static(publicDir, {
      etag: true,
      maxAge: "1h",
      setHeaders(res, path) {
        if (path.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      }
    }));

    app.get(/.*/, (_req, res) => {
      res.sendFile(join(publicDir, "index.html"));
    });

    app.listen(port, () => {
      console.log(`Gesture Boids Simulator listening on http://localhost:${port}`);
    });

    return true;
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND") {
      throw error;
    }
    return false;
  }
}

function startFallbackServer() {
  const server = createServer((req, res) => {
    const requestPath = new URL(req.url || "/", `http://${req.headers.host}`).pathname;
    const decodedPath = decodeURIComponent(requestPath);
    const normalizedPath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
    const requestedFile = normalizedPath === "/" ? "index.html" : normalizedPath.slice(1);
    const filePath = join(publicDir, requestedFile);
    const indexPath = join(publicDir, "index.html");
    const isInsidePublic = filePath.startsWith(publicDir);
    const resolvedPath = isInsidePublic && existsSync(filePath) ? filePath : indexPath;
    const extension = extname(resolvedPath);

    for (const [key, value] of Object.entries(securityHeaders)) {
      res.setHeader(key, value);
    }
    res.setHeader("Content-Type", contentTypes[extension] || "application/octet-stream");
    if (extension === ".html") {
      res.setHeader("Cache-Control", "no-cache");
    }

    createReadStream(resolvedPath)
      .on("error", () => {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
      })
      .pipe(res);
  });

  server.listen(port, () => {
    console.log(`Gesture Boids Simulator listening on http://localhost:${port}`);
    console.log("Express is not installed locally; using the built-in static server fallback.");
  });
}

if (!(await startExpressServer())) {
  startFallbackServer();
}

export { rootDir, publicDir };
