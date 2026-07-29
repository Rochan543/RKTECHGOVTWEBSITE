import 'dotenv/config';
import { db, usersTable } from '@workspace/db';
import { eq } from 'drizzle-orm';

const email = `prod-audit-user-${Date.now()}@example.com`;
const password = 'TestPassword123!';

async function runRegister() {
  console.log(`\n1. Registering user: ${email}...`);
  const res = await fetch('https://rktechgovtwebsite.onrender.com/api/v1/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Production Audit User',
      email: email,
      password: password,
      phone: '1234567890'
    }),
  });

  console.log('Register Response Status:', res.status);
  const cookieHeader = res.headers.get('set-cookie');
  console.log('Register Set-Cookie header:', cookieHeader);
  
  const body = await res.json();
  return { token: body.token, userId: body.user.id };
}

async function runGetMe(cookie: string) {
  console.log('\n2. Calling /api/v1/auth/me...');
  const res = await fetch('https://rktechgovtwebsite.onrender.com/api/v1/auth/me', {
    headers: {
      'Cookie': cookie
    }
  });

  console.log('Me Response Status:', res.status);
  const body = await res.json();
  console.log('Me Response Body (id, name, role):', { id: body.id, name: body.name, role: body.role });
  return res.status;
}

async function runGetStats(cookie: string, description: string) {
  console.log(`\n3. Calling /api/v1/admin/stats (${description})...`);
  const res = await fetch('https://rktechgovtwebsite.onrender.com/api/v1/admin/stats', {
    headers: {
      'Cookie': cookie
    }
  });

  console.log('Stats Response Status:', res.status);
  const body = await res.json();
  if (res.status === 200) {
    console.log('Stats Response Body (keys):', Object.keys(body));
  } else {
    console.log('Stats Response Error:', body);
  }
  return res.status;
}

async function main() {
  console.log('=== STARTING PRODUCTION AUTH AUDIT VERIFICATION ===');
  
  // 1. Register & Verify Set-Cookie
  const { token, userId } = await runRegister();
  const cookie = `token=${token}`;

  // 2. Verify /auth/me returns 200
  const meStatus = await runGetMe(cookie);

  // 3. Verify /admin/stats returns 403 (student)
  const statsStatusStudent = await runGetStats(cookie, 'As Student');

  // 4. Elevate role to admin in Neon Database
  console.log(`\n4. Elevating user ID ${userId} to 'admin' in Neon database...`);
  await db.update(usersTable).set({ role: 'admin' }).where(eq(usersTable.id, userId));
  console.log('Database update completed.');

  // 5. Verify /admin/stats returns 200 (admin)
  const statsStatusAdmin = await runGetStats(cookie, 'As Admin');

  // 6. Cleanup database
  console.log('\n5. Cleaning up database (deleting test user)...');
  await db.delete(usersTable).where(eq(usersTable.id, userId));
  console.log('Cleanup completed.');

  console.log('\n=== AUDIT VERIFICATION COMPLETED ===');
}

main().catch(console.error);
