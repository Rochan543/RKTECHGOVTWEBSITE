import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// Rate limiting: 200 requests per 15 minutes per IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use("/api", router);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(err, "Unhandled Express error");

  const statusCode = err.status || err.statusCode || 500;
  let message = "An unexpected error occurred.";

  if (statusCode < 500) {
    message = err.message || "Client error";
  } else {
    // Hide raw Postgres/drizzle/Cloudinary connection and query details in 500 errors
    if (process.env.NODE_ENV !== "production") {
      message = err.message || "Internal Server Error";
    } else {
      message = "Internal Server Error";
    }
  }

  res.status(statusCode).json({ error: message });
});

export default app;
