import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getCookieOptions } from "../middlewares/auth";
import { readFileSync } from "fs";
import { join } from "path";

const router: IRouter = Router();

let buildInfo = { commit: "unknown", buildDate: "unknown" };
try {
  const buildInfoPath = join(process.cwd(), "artifacts/api-server/dist/version.json");
  buildInfo = JSON.parse(readFileSync(buildInfoPath, "utf-8"));
} catch (e) {
  try {
    const buildInfoPath = join(__dirname, "version.json");
    buildInfo = JSON.parse(readFileSync(buildInfoPath, "utf-8"));
  } catch (err) {
    // Ignore
  }
}

router.get("/healthz", (req, res) => {
  const data = {
    status: "ok",
    version: "1.1.0-production-fixes",
    commit: buildInfo.commit,
    buildDate: buildInfo.buildDate,
    nodeVersion: process.version,
    env: process.env.NODE_ENV,
    headers: req.headers,
    cookieOptions: getCookieOptions(req)
  };
  res.json(data);
});

export default router;
