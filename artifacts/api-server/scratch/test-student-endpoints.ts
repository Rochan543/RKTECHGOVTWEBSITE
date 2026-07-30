import 'dotenv/config';
import http from 'http';
import app from '../src/app';
import { signToken } from '../src/middlewares/auth';

const token = signToken({ userId: 2, role: 'student' });
const cookie = `token=${token}`;

const server = http.createServer(app);
server.listen(0, async () => {
  const address = server.address() as any;
  const port = address.port;
  console.log('Test server running on port:', port);

  const endpoints = [
    '/api/v1/auth/me',
    '/api/v1/practice/stats',
    '/api/v1/adaptive/dashboard',
    '/api/v1/adaptive/recommendations',
    '/api/v1/adaptive/mastery',
    '/api/v1/adaptive/study-plan',
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`http://localhost:${port}${endpoint}`, {
        headers: {
          'Cookie': cookie
        }
      });
      console.log(`Endpoint: ${endpoint} -> Status: ${res.status}`);
      const text = await res.text();
      console.log(`Response: ${text}\n`);
    } catch (err) {
      console.error(`Error fetching ${endpoint}:`, err);
    }
  }

  server.close();
});
