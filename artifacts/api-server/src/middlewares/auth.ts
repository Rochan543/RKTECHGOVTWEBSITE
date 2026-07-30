import { Request, Response, NextFunction } from "express";
import { createHmac } from "crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const _jwtSecret = process.env.SESSION_SECRET;
if (!_jwtSecret) {
  throw new Error("SESSION_SECRET environment variable is required but not set");
}
const JWT_SECRET: string = _jwtSecret;

// Minimal JWT implementation (no external deps)
export function signToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) })).toString("base64url");
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token: string): Record<string, unknown> | null {
  try {
    const [header, body, sig] = token.split(".");
    const expected = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    if (sig !== expected) return null;
    return JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
}

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
  user?: any;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  console.log("=== requireAuth CALLED ===");
  console.log("Path:", req.path);
  console.log("req.cookies:", JSON.stringify(req.cookies));
  console.log("req.headers.cookie:", req.headers.cookie);
  console.log("req.headers.authorization:", req.headers.authorization);

  let token = "";
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
    console.log("Token extracted from Authorization header:", token);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
    console.log("Token extracted from req.cookies.token:", token);
  } else {
    console.log("No token found in Authorization header or cookies.");
  }

  if (!token) {
    console.log("Decision: No token, returning 401 Unauthorized");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const payload = verifyToken(token);
  console.log("verifyToken() result (decoded payload):", JSON.stringify(payload));
  if (!payload || typeof payload.userId !== "number") {
    console.log("Decision: Token verification failed or userId is not a number, returning 401 Invalid token");
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  // Always re-validate from DB so role changes (e.g. promotion to super_admin)
  // take effect immediately without requiring a re-login.
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId as number));

  console.log("Database lookup result for userId", payload.userId, ":", JSON.stringify(user));
  if (!user) {
    console.log("Decision: User not found in database, returning 401 User not found");
    res.status(401).json({ error: "User not found" });
    return;
  }
  
  console.log("User role:", user.role, "User status:", user.status);
  if (user.status === "suspended") {
    console.log("Decision: User is suspended, returning 403 Account suspended");
    res.status(403).json({ error: "Account suspended" });
    return;
  }

  console.log("Decision: Authentication successful for userId", payload.userId, "role", user.role);
  req.userId = payload.userId as number;
  req.userRole = user.role; // Always use DB role — never stale JWT role
  req.user = user; // Request.user population
  next();
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, async () => {
    if (req.userRole !== "admin" && req.userRole !== "super_admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  });
}

export async function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, async () => {
    if (req.userRole !== "super_admin") {
      res.status(403).json({ error: "Super admin access required" });
      return;
    }
    next();
  });
}

export function getCookieOptions(req: Request) {
  const host = req.headers.host || "";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");

  return {
    httpOnly: true,
    secure: !isLocal,
    sameSite: isLocal ? ("lax" as const) : ("none" as const),
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

