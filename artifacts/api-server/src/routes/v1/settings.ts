import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();
const BCRYPT_ROUNDS = 12;

const UpdateProfileBody = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().nullable().optional(),
});

const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.patch("/v1/settings/profile", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const userId = req.userId!;
  const { name, phone } = parsed.data;

  if (name === undefined && phone === undefined) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const setValues: { name?: string; phone?: string | null } = {};
  if (name !== undefined) setValues.name = name;
  if (phone !== undefined) setValues.phone = phone;

  const [user] = await db.update(usersTable)
    .set(setValues)
    .where(eq(usersTable.id, userId))
    .returning();

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone ?? null,
  });
});

router.post("/v1/settings/change-password", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const userId = req.userId!;
  const { currentPassword, newPassword } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, userId));
  res.json({ message: "Password changed successfully" });
});

export default router;
