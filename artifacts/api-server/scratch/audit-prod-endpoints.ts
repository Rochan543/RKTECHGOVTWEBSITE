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
  const body: any = await res.json();
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Register failed: ${JSON.stringify(body)}`);
  }
  return { token: body.token, user: body.user };
}

async function auditEndpoint(cookie: string, path: string) {
  console.log(`\nAuditing endpoint: GET ${path}...`);
  const res = await fetch(`https://rktechgovtwebsite.onrender.com${path}`, {
    headers: {
      'Cookie': cookie
    }
  });

  console.log(`Response Status for ${path}:`, res.status);
  let body: any;
  try {
    body = await res.json();
    console.log(`Response Body for ${path}:`, JSON.stringify(body, null, 2));
  } catch (err) {
    body = await res.text();
    console.log(`Response Text (Not JSON) for ${path}:`, body);
  }
  return { status: res.status, body };
}

async function main() {
  console.log('=== STARTING PRODUCTION CURRENT AFFAIRS AUDIT ===');
  
  // 1. Register
  const { token } = await runRegister();
  const cookie = `token=${token}`;

  // 2. Audit Current Affairs Endpoints
  await auditEndpoint(cookie, '/api/v1/current-affairs/categories');
  await auditEndpoint(cookie, '/api/v1/current-affairs/monthly');
  await auditEndpoint(cookie, '/api/v1/current-affairs/history');
  await auditEndpoint(cookie, '/api/v1/current-affairs/quiz');
  await auditEndpoint(cookie, '/api/v1/current-affairs');
  
  // 3. Audit Practice Stats Endpoint
  await auditEndpoint(cookie, '/api/v1/practice/stats');
  
  console.log('\n=== AUDIT COMPLETED ===');
}

main().catch(async (err) => {
  console.error('Audit failed:', err);
});
