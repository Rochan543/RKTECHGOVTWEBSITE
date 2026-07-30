import 'dotenv/config';
import http from 'http';
import app from '../src/app';

const server = http.createServer(app);
server.listen(0, async () => {
  const address = server.address() as any;
  const port = address.port;
  console.log('Test server running on port:', port);

  try {
    const email = `student-flow-${Date.now()}@example.com`;
    // 1. Register student
    console.log('Registering student...');
    const regRes = await fetch(`http://localhost:${port}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Student',
        email,
        password: 'Password123!',
        phone: '1234567890'
      })
    });
    console.log('Register status:', regRes.status);
    const regBody: any = await regRes.json();
    const token = regBody.token;
    console.log('Registered token:', token);

    const cookie = `token=${token}`;

    // 2. Fetch practice/stats
    console.log('Fetching practice stats...');
    const statsRes = await fetch(`http://localhost:${port}/api/v1/practice/stats`, {
      headers: { 'Cookie': cookie }
    });
    console.log('Practice stats status:', statsRes.status);
    console.log('Practice stats response:', await statsRes.text());

    // 3. Fetch adaptive/dashboard
    console.log('Fetching adaptive dashboard...');
    const dashRes = await fetch(`http://localhost:${port}/api/v1/adaptive/dashboard`, {
      headers: { 'Cookie': cookie }
    });
    console.log('Adaptive dashboard status:', dashRes.status);
    console.log('Adaptive dashboard response:', await dashRes.text());

  } catch (err) {
    console.error('Error during student flow:', err);
  } finally {
    server.close();
  }
});
