const { Client } = require('pg');
const fs = require('fs');

const envPath = 'c:/Users/premr/Downloads/RKTECHGOVTWEBSITEV2zip/RKTECHGOVTWEBSITEV2zip/artifacts/api-server/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/APP_DATABASE_URL="([^"]+)"/) || envContent.match(/DATABASE_URL="([^"]+)"/);
if (!dbUrlMatch) {
  console.error("No database URL found in .env");
  process.exit(1);
}
const connectionString = dbUrlMatch[1];
const cleanConnectionString = connectionString
  .replace(/sslmode=[^&]*/g, "")
  .replace(/channel_binding=[^&]*/g, "")
  .replace(/\?&/g, "?")
  .replace(/&&/g, "&")
  .replace(/[&?]$/g, "");

const client = new Client({
  connectionString: cleanConnectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();

  console.log("Listing all foreign keys referencing table 'questions'...");

  const query = `
    SELECT
        tc.table_name AS referencing_table,
        kcu.column_name AS referencing_column,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column,
        rc.delete_rule AS on_delete_action
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints AS rc
          ON rc.constraint_name = tc.constraint_name
    WHERE 
        tc.constraint_type = 'FOREIGN KEY' 
        AND ccu.table_name = 'questions';
  `;

  const res = await client.query(query);
  console.log(`Found ${res.rows.length} foreign key constraints:\n`);
  console.table(res.rows);

  await client.end();
}

main().catch(console.error);
