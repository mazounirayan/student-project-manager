import 'dotenv/config';
export function jwtSecret(name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET'): string {
  const value = process.env[name];
  if (!value || value.length < 32) throw new Error(`${name} must contain at least 32 characters`);
  return value;
}
