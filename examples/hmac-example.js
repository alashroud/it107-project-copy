/**
 * HMAC Authentication Example
 * 
 * This script demonstrates how to use HMAC authentication with the API.
 */

const { createSignedRequestHeaders, generateClientCredentials } = require('../utils/hmacAuth');

// Step 1: Generate client credentials (do this once per client)
console.log('=== HMAC Authentication Example ===\n');
console.log('Step 1: Generate client credentials');
const credentials = generateClientCredentials('example-app');
console.log('Client ID:', credentials.clientId);
console.log('Secret:', credentials.secret);
console.log('Algorithm:', credentials.algorithm);
console.log('Created:', credentials.createdAt);

// Step 2: Create signed request headers
console.log('\nStep 2: Create signed request headers for a GET request');
const method = 'GET';
const path = '/api/convert?from=USD&to=EUR';
const headers = createSignedRequestHeaders(method, path, null, credentials.clientId, credentials.secret);

console.log('Request headers:');
Object.entries(headers).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

// Step 3: Usage example with fetch
console.log('\nStep 3: Usage example with fetch/curl');
console.log('\nUsing curl:');
console.log(`curl -X ${method} \\`);
console.log(`  -H "X-Signature: ${headers['X-Signature']}" \\`);
console.log(`  -H "X-Timestamp: ${headers['X-Timestamp']}" \\`);
console.log(`  -H "X-Client-ID: ${headers['X-Client-ID']}" \\`);
console.log(`  "http://localhost:3000${path}"`);

console.log('\nUsing fetch in Node.js:');
console.log(`
const response = await fetch('http://localhost:3000${path}', {
  method: '${method}',
  headers: {
    'X-Signature': '${headers['X-Signature']}',
    'X-Timestamp': '${headers['X-Timestamp']}',
    'X-Client-ID': '${headers['X-Client-ID']}'
  }
});
const data = await response.json();
console.log(data);
`);

// Step 4: Create signed request with body (POST example)
console.log('\nStep 4: Example with POST request and body');
const postMethod = 'POST';
const postPath = '/api/some-endpoint';
const body = { key: 'value', amount: 100 };
const postHeaders = createSignedRequestHeaders(postMethod, postPath, body, credentials.clientId, credentials.secret);

console.log('POST request headers:');
Object.entries(postHeaders).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

console.log('\nNote: Store the secret securely and never commit it to version control!');
console.log('In production, secrets should be stored in environment variables or a secrets manager.');
