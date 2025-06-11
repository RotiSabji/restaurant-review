// generate-oidc-jwks.js
// Usage: node generate-oidc-jwks.js
const fs = require('fs');
const { generateKeyPairSync } = require('crypto');

const JWKS_FILE = './oidc_jwks.json';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const pubJwk = publicKey.export({ format: 'jwk' });
const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
const jwks = {
  keys: [{ ...pubJwk, kid: 'dev-key', alg: 'RS256', use: 'sig' }],
  privateKeyPem: privPem,
  publicKeyPem: pubPem,
};
fs.writeFileSync(JWKS_FILE, JSON.stringify(jwks, null, 2));
console.log('oidc_jwks.json generated successfully.');
