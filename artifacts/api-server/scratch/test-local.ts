import 'dotenv/config';
import http from 'http';
import app from '../src/app';

async function testRegisterScenario(origin: string, hostHeader: string, email: string) {
  return new Promise<{ status: number; headers: Record<string, string> }>((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, async () => {
      const address = server.address() as any;
      const port = address.port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': origin,
            'Host': hostHeader, // Explicitly set host header to test routing/cookie logic
          },
          body: JSON.stringify({
            name: 'Local Verification User',
            email: email,
            password: 'TestPassword123!',
            phone: '1234567890'
          }),
        });

        const headers: Record<string, string> = {};
        res.headers.forEach((val, key) => {
          headers[key] = val;
        });

        server.close(() => {
          resolve({ status: res.status, headers });
        });
      } catch (err) {
        server.close(() => {
          reject(err);
        });
      }
    });
  });
}

async function main() {
  console.log('--- STARTING LOCAL COOKIE AUDIT TEST ---');

  // Scenario 1: Local request (from localhost to localhost)
  const localEmail = `local-test-${Date.now()}@example.com`;
  console.log(`\nScenario 1: Simulating request from Localhost frontend (email: ${localEmail})...`);
  const localRes = await testRegisterScenario('http://localhost:5173', 'localhost', localEmail);
  console.log('Register Status:', localRes.status);
  console.log('Set-Cookie header:', localRes.headers['set-cookie']);

  // Scenario 2: Production request (from netlify to render)
  const prodEmail = `prod-test-${Date.now()}@example.com`;
  console.log(`\nScenario 2: Simulating request from Netlify frontend (email: ${prodEmail})...`);
  const prodRes = await testRegisterScenario('https://rkexamplatform.netlify.app', 'rktechgovtwebsite.onrender.com', prodEmail);
  console.log('Register Status:', prodRes.status);
  console.log('Set-Cookie header:', prodRes.headers['set-cookie']);
}

main().catch(console.error);
