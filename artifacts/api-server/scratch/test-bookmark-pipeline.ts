import 'dotenv/config';
import http from 'http';
import app from '../src/app';
import { db, bookmarksTable, questionsTable } from '@workspace/db';
import { eq } from 'drizzle-orm';

const server = http.createServer(app);
server.listen(0, async () => {
  const address = server.address() as any;
  const port = address.port;
  console.log('Test server running on port:', port);

  try {
    // Find a valid question ID in the database
    const questions = await db.select({ id: questionsTable.id }).from(questionsTable).limit(1);
    if (questions.length === 0) {
      console.error("No questions found in questionsTable to bookmark!");
      server.close();
      return;
    }
    const targetQuestionId = questions[0].id;
    console.log(`Using question ID: ${targetQuestionId} for bookmark testing`);

    const email = `bookmark-test-${Date.now()}@example.com`;
    console.log('Registering test student...');
    const regRes = await fetch(`http://localhost:${port}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bookmark Student',
        email,
        password: 'Password123!',
        phone: '1234567890'
      })
    });
    console.log('Register status:', regRes.status);
    const regBody: any = await regRes.json();
    const token = regBody.token;
    const userId = regBody.user.id;
    console.log(`Registered user ID: ${userId}, token exists: ${!!token}`);

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // 1. Post to bookmarks endpoint
    console.log(`Posting bookmark for question ${targetQuestionId}...`);
    const postRes = await fetch(`http://localhost:${port}/api/v1/bookmarks`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ questionId: targetQuestionId })
    });
    console.log('POST /api/v1/bookmarks status:', postRes.status);
    const postBody: any = await postRes.json();
    console.log('POST response:', postBody);

    // 2. Query the DB directly to check if bookmark row exists
    const dbRows = await db.select().from(bookmarksTable).where(eq(bookmarksTable.userId, userId));
    console.log(`Database rows for userId ${userId}:`, dbRows);

    // 3. Call GET /api/v1/bookmarks
    console.log('Fetching bookmarks...');
    const getRes = await fetch(`http://localhost:${port}/api/v1/bookmarks`, {
      headers: authHeaders
    });
    console.log('GET /api/v1/bookmarks status:', getRes.status);
    const getBody: any = await getRes.json();
    console.log('GET response:', JSON.stringify(getBody, null, 2));

    // 4. Verify DELETE /api/v1/bookmarks/:questionId
    console.log(`Deleting bookmark for question ${targetQuestionId}...`);
    const delRes = await fetch(`http://localhost:${port}/api/v1/bookmarks/${targetQuestionId}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    console.log('DELETE status:', delRes.status);
    const delBody: any = await delRes.json();
    console.log('DELETE response:', delBody);

    // 5. Query DB again
    const dbRowsAfter = await db.select().from(bookmarksTable).where(eq(bookmarksTable.userId, userId));
    console.log(`Database rows for userId ${userId} after delete:`, dbRowsAfter);

  } catch (err) {
    console.error('Error during bookmark pipeline test:', err);
  } finally {
    server.close();
  }
});
