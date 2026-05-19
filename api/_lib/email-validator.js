import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const disposableDomains = require('disposable-email-domains');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const disposableSet = new Set(disposableDomains.map(d => d.toLowerCase()));

export function validate(email) {
  const normalized = (email || '').trim().toLowerCase();

  if (!normalized || !EMAIL_RE.test(normalized)) {
    return { valid: false, reason: 'formato' };
  }

  const domain = normalized.split('@')[1];

  if (disposableSet.has(domain)) {
    return { valid: false, reason: 'desechable' };
  }

  return { valid: true };
}
