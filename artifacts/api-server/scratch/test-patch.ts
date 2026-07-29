import 'dotenv/config';
import app from '../src/app';
import { signToken } from '../src/middlewares/auth';

const token = signToken({ userId: 2, role: 'student' });

console.log('Signed token:', token);

// We will mock a request to Express
import request from 'supertest';

// Wait, since we don't want to install supertest, let's do a fetch using a temporary server
import http from 'http';

const server = http.createServer(app);
server.listen(0, async () => {
  const address = server.address() as any;
  const port = address.port;
  console.log('Testing server running on port:', port);

  try {
    const res = await fetch(`http://localhost:${port}/api/v1/users/2`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `token=${token}`
      },
      body: JSON.stringify({
        name: 'rochan updated',
        phone: '1234567890',
        avatarUrl: null
      })
    });

    console.log('Response status:', res.status);
    const body = await res.text();
    console.log('Response body:', body);
  } catch (err) {
    console.error('Fetch error:', err);
  } finally {
    server.close();
  }
});
