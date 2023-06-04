if ('Bun' in globalThis) {
  throw new Error('❌ Use Node.js to run this test!');
}

import { staticPlugin } from '@elysiajs/static';

if (typeof staticPlugin !== 'function') {
  throw new Error('❌ ESM Node.js failed');
}

console.log('✅ ESM Node.js works!');
