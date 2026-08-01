const path = require('path');
const { spawnSync } = require('child_process');

// Load environment variables from .env
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

console.log("Environment variables loaded. Spawning verify-delete.ts...");

const result = spawnSync('npx', ['tsx', 'scratch/verify-delete.ts'], {
  env: { ...process.env },
  stdio: 'inherit',
  shell: true
});

process.exit(result.status ?? 0);
