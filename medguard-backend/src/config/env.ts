import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface EnvConfig {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PORT: number;
  NODE_ENV: string;
}

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const env: EnvConfig = {
  SUPABASE_URL: getRequiredEnv('SUPABASE_URL'),
  SUPABASE_ANON_KEY: getRequiredEnv('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  PORT: parseInt(getOptionalEnv('PORT', '8080'), 10),
  NODE_ENV: getOptionalEnv('NODE_ENV', 'development'),
};

// Validate Supabase URL format
if (!env.SUPABASE_URL.startsWith('https://')) {
  throw new Error('SUPABASE_URL must be a valid HTTPS URL');
}

console.log(`[env] Loaded configuration for ${env.NODE_ENV} environment`);
console.log(`[env] Supabase URL: ${env.SUPABASE_URL.substring(0, 30)}...`);
