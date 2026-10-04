import { betterAuth } from 'better-auth';
import { getPool } from './db';

export function createAuth(bootstrap = false) {
  const secret = process.env.BETTER_AUTH_SECRET;
  const origin = process.env.BETTER_AUTH_URL;
  if (!secret || secret.length < 32 || !origin) throw new Error('AUTH_NOT_CONFIGURED');
  const url = new URL(origin);
  if (process.env.VERCEL && url.protocol !== 'https:') throw new Error('HTTPS_REQUIRED_ON_VERCEL');
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('HTTPS_REQUIRED');
  return betterAuth({
    appName: 'PolarBridge', database: getPool(), secret, baseURL: origin,
    trustedOrigins: [url.origin],
    emailAndPassword: { enabled: true, disableSignUp: !bootstrap, minPasswordLength: 12 },
    session: { expiresIn: 8 * 60 * 60, updateAge: 60 * 60, cookieCache: { enabled: false } },
    advanced: { useSecureCookies: url.protocol === 'https:' },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 60,
      customRules: { '/sign-in/email': { window: 60, max: 5 } } },
  });
}
let auth: ReturnType<typeof createAuth> | undefined;
export function getAuth() { return auth ??= createAuth(); }
