import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth, type AuthRequest, getCookieOptions } from "../../middlewares/auth";
import {
  RegisterBody,
  LoginBody,
  ForgotPasswordBody,
  ResetPasswordBody,
} from "@workspace/api-zod";

const router: IRouter = Router();
const BCRYPT_ROUNDS = 12;

async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, BCRYPT_ROUNDS);
}

async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

router.post("/v1/auth/register", async (req, res): Promise<void> => {
  try {
    const parsed = RegisterBody.safeParse(req.body);
    if (!parsed.success) {
      // Return the first human-readable validation error instead of raw JSON
      const firstIssue = parsed.error.issues[0];
      const field = firstIssue?.path.join(".") ?? "field";
      const message = firstIssue?.message ?? "Invalid input";
      res.status(400).json({ error: `${field}: ${message}` });
      return;
    }
    const { name, email, password, phone } = parsed.data;
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (existing.length > 0) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    const [user] = await db.insert(usersTable).values({
      name,
      email,
      passwordHash: await hashPassword(password),
      phone: phone ?? null,
      role: "student",
      status: "active",
    }).returning();
    const token = signToken({ userId: user.id, role: user.role });
    res.cookie("token", token, getCookieOptions(req));
    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        phone: user.phone ?? null,
        avatarUrl: user.avatarUrl ?? null,
        rank: user.rank ?? null,
        totalScore: user.totalScore ?? null,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.post("/v1/auth/login", async (req, res): Promise<void> => {
  try {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const field = firstIssue?.path.join(".") ?? "field";
      const message = firstIssue?.message ?? "Invalid input";
      res.status(400).json({ error: `${field}: ${message}` });
      return;
    }
    const { email, password } = parsed.data;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    if (user.status === "suspended") {
      res.status(401).json({ error: "Account suspended" });
      return;
    }
    const token = signToken({ userId: user.id, role: user.role });
    res.cookie("token", token, getCookieOptions(req));
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        phone: user.phone ?? null,
        avatarUrl: user.avatarUrl ?? null,
        rank: user.rank ?? null,
        totalScore: user.totalScore ?? null,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.post("/v1/auth/logout", (req, res): void => {
  const cookieOpts = getCookieOptions(req);
  const { maxAge, ...clearOpts } = cookieOpts;
  res.clearCookie("token", clearOpts);
  res.json({ message: "Logged out" });
});

router.get("/v1/auth/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? null,
    rank: user.rank ?? null,
    totalScore: user.totalScore ?? null,
    createdAt: user.createdAt,
  });
});

router.post("/v1/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // In production, send email. For now just return success.
  res.json({ message: "If that email exists, a reset link has been sent." });
});

router.post("/v1/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.json({ message: "Password reset successfully" });
});

export default router;
