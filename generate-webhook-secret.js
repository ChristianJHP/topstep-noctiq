#!/usr/bin/env node

/**
 * Generate a secure random webhook secret
 * Usage: node generate-webhook-secret.js
 */

const crypto = require('crypto');

const secret = crypto.randomBytes(32).toString('hex');

console.log('\n=================================');
console.log('Generated Webhook Secret:');
console.log('=================================');
console.log(secret);
console.log('=================================\n');
console.log('Add this to your .env.local file:');
console.log(`WEBHOOK_SECRET=${secret}`);
console.log('\n');
