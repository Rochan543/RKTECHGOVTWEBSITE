import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getCookieOptions } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/healthz", (req, res) => {
  const data = {
    status: "ok",
    version: "1.1.0-production-fixes",
    env: process.env.NODE_ENV,
    headers: req.headers,
    cookieOptions: getCookieOptions(req)
  };
  res.json(data);
});

export default router;
