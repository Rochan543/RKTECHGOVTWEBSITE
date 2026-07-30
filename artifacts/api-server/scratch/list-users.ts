import 'dotenv/config';
import { db, usersTable } from '@workspace/db';

async function main() {
  console.log("Fetching users from Neon database...");
  const users = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    status: usersTable.status
  }).from(usersTable);

  console.log(`Found ${users.length} users:`);
  console.table(users);
}

main().catch(console.error);
