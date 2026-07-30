import 'dotenv/config';

async function main() {
  const prodUrl = 'https://rktechgovtwebsite.onrender.com';
  const email = `test-prod-student-${Date.now()}@example.com`;
  console.log(`Registering student on prod: ${email}...`);

  const regRes = await fetch(`${prodUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Prod Student',
      email,
      password: 'Password123!',
      phone: '1234567890'
    })
  });

  console.log('Register status:', regRes.status);
  const regBody: any = await regRes.json();
  const token = regBody.token;
  console.log('Token:', token);

  const cookie = `token=${token}`;

  const endpoints = [
    '/api/v1/auth/me',
    '/api/v1/practice/stats',
    '/api/v1/adaptive/dashboard',
    '/api/v1/adaptive/recommendations',
    '/api/v1/adaptive/mastery',
    '/api/v1/adaptive/study-plan',
    '/api/v1/adaptive/revision-queue'
  ];

  for (const endpoint of endpoints) {
    const res = await fetch(`${prodUrl}${endpoint}`, {
      headers: {
        'Cookie': cookie,
        'Authorization': `Bearer ${token}`
      }
    });
    console.log(`Endpoint: ${endpoint} -> Status: ${res.status}`);
    const text = await res.text();
    console.log(`Response: ${text.slice(0, 100)}\n`);
  }
}

main().catch(console.error);
