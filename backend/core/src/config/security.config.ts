import { registerAs } from '@nestjs/config';

export const securityConfig = registerAs('security', () => ({
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  // Keycloak Configuration
  keycloak: {
    baseUrl: process.env.KEYCLOAK_BASE_URL || 'http://localhost:8080',
    realm: process.env.KEYCLOAK_REALM || 'portvision360',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'portvision360-backend',
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || 'your-client-secret',
    adminUsername: process.env.KEYCLOAK_ADMIN_USERNAME || 'admin',
    adminPassword: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin123',
  },
  
  // Rate Limiting
  rateLimitTtl: parseInt(process.env.RATE_LIMIT_TTL, 10) || 60, // seconds
  rateLimitLimit: parseInt(process.env.RATE_LIMIT_LIMIT, 10) || 100, // requests per TTL
  
  // CORS
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3002').split(','),
  
  // Encryption
  encryptionKey: process.env.ENCRYPTION_KEY || 'your-encryption-key-32-characters',
  
  // Password Policy
  password: {
    minLength: parseInt(process.env.PASSWORD_MIN_LENGTH, 10) || 8,
    requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
    requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
    requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false',
    requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL_CHARS !== 'false',
  },
  
  // Session
  session: {
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    maxAge: parseInt(process.env.SESSION_MAX_AGE, 10) || 24 * 60 * 60 * 1000, // 24 hours
  },
}));