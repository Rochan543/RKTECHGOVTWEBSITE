import 'dotenv/config';
import { getCookieOptions } from '../src/middlewares/auth';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ Passed: ${message}`);
}

function main() {
  console.log('--- RUNNING COOKIE OPTIONS UNIT TESTS ---');

  // Test 1: Local Host
  const localOpts = getCookieOptions({ headers: { host: 'localhost:3000' } } as any);
  assert(localOpts.secure === false, 'Local host should not use secure cookies');
  assert(localOpts.sameSite === 'lax', 'Local host should use sameSite: lax');
  assert(localOpts.path === '/', 'Cookie path should be /');

  // Test 2: Local IP Host
  const ipOpts = getCookieOptions({ headers: { host: '127.0.0.1:3000' } } as any);
  assert(ipOpts.secure === false, 'Local IP should not use secure cookies');
  assert(ipOpts.sameSite === 'lax', 'Local IP should use sameSite: lax');

  // Test 3: Production Host (Render)
  const prodOpts = getCookieOptions({ headers: { host: 'rktechgovtwebsite.onrender.com' } } as any);
  assert(prodOpts.secure === true, 'Production host must use secure cookies');
  assert(prodOpts.sameSite === 'none', 'Production host must use sameSite: none');
  assert(prodOpts.path === '/', 'Cookie path should be /');

  console.log('\nALL COOKIE OPTIONS UNIT TESTS PASSED SUCCESSFULLY!');
}

main();
