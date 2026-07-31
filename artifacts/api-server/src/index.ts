import "dotenv/config";

import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

logger.info("Server version: 1.1.0-production-fixes");

const printRoutes = () => {
  try {
    const routes: string[] = [];
    const split = (thing: any) => {
      if (!thing) return "";
      if (typeof thing === "string") return thing.split("/");
      if (thing.fast_slash) return "";
      const match = thing.toString()
        .replace("\\/?", "")
        .replace("(?=\\/|$)", "")
        .match(/^\/\^((?:\\[.*+?^${}()|[\]\\\/]|[^$^*\/])+)\$\//);
      return match
        ? match[1].replace(/\\(.)/g, "$1").split("/")
        : thing.toString();
    };

    const printLayer = (path: any[], layer: any) => {
      if (layer.route) {
        layer.route.stack.forEach((subLayer: any) => printLayer(path.concat(split(layer.route.path)), subLayer));
      } else if (layer.name === "router" && layer.handle && layer.handle.stack) {
        layer.handle.stack.forEach((subLayer: any) => printLayer(path.concat(split(layer.regexp)), subLayer));
      } else if (layer.method) {
        const fullPath = path.concat(split(layer.regexp)).filter(Boolean).join("/");
        routes.push(`${layer.method.toUpperCase()} /api/${fullPath}`);
      }
    };

    if ((app as any)._router && (app as any)._router.stack) {
      (app as any)._router.stack.forEach((layer: any) => printLayer([], layer));
    }
    logger.info({ count: routes.length }, "Registered express routes parsed successfully");
  } catch (err) {
    logger.error(err, "Failed to print registered routes");
  }
};

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  printRoutes();
});

process.on("unhandledRejection", (reason) => {
  logger.error(reason instanceof Error ? reason : new Error(String(reason)), "Unhandled Promise Rejection");
});

process.on("uncaughtException", (error) => {
  logger.error(error, "Uncaught Exception");
  server.close(() => {
    process.exit(1);
  });
  // Force exit after a short timeout if server.close hangs
  setTimeout(() => process.exit(1), 1000);
});