import { db, usersTable } from "../lib/db/src/index";
import { eq, or } from "drizzle-orm";

async function main() {
  try {
    const admins = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role })
      .from(usersTable)
      .where(or(eq(usersTable.role, "admin"), eq(usersTable.role, "super_admin")));

    console.log("Found admins/super_admins:");
    console.log(JSON.stringify(admins, null, 2));
  } catch (error) {
    console.error("Failed to find admin:", error);
  }
}

main();
