import { db, usersTable, notificationsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { logger } from "./logger";
import { Response } from "express";

export interface SseClient {
  userId: number;
  res: Response;
}

export const activeClients: SseClient[] = [];

export async function createNotificationForStudents(
  title: string,
  body: string,
  type: "exam_result" | "new_exam" | "announcement" | "achievement" | "system" = "system",
  link?: string
) {
  try {
    const students = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.role, "student"));

    if (students.length === 0) return;

    // Batch insert notifications
    const values = students.map(s => ({
      userId: s.id,
      title,
      body,
      type,
      link: link ?? null,
      isRead: false,
    }));

    await db.insert(notificationsTable).values(values);

    // Notify active student clients
    const studentIds = new Set(students.map(s => s.id));
    for (const client of activeClients) {
      if (studentIds.has(client.userId)) {
        client.res.write(`data: ${JSON.stringify({ type: "new_notification" })}\n\n`);
      }
    }
  } catch (error) {
    logger.error(error, "Error creating notifications for students");
  }
}

export async function createNotificationForAdmins(
  title: string,
  body: string,
  type: "exam_result" | "new_exam" | "announcement" | "achievement" | "system" = "system",
  link?: string
) {
  try {
    const admins = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(inArray(usersTable.role, ["admin", "super_admin"]));

    if (admins.length === 0) return;

    // Batch insert notifications
    const values = admins.map(a => ({
      userId: a.id,
      title,
      body,
      type,
      link: link ?? null,
      isRead: false,
    }));

    await db.insert(notificationsTable).values(values);

    // Notify active admin clients
    const adminIds = new Set(admins.map(a => a.id));
    for (const client of activeClients) {
      if (adminIds.has(client.userId)) {
        client.res.write(`data: ${JSON.stringify({ type: "new_notification" })}\n\n`);
      }
    }
  } catch (error) {
    logger.error(error, "Error creating notifications for admins");
  }
}
