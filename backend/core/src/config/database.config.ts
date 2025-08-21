import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
  name: process.env.DB_NAME || 'portvision360',
  schema: process.env.DB_SCHEMA || 'public',
  ssl: process.env.DB_SSL === 'true',
  synchronize: process.env.DB_SYNC === 'true',
  migrationsRun: process.env.DB_MIGRATIONS_RUN !== 'false',
  logging: process.env.NODE_ENV === 'development',
  
  // Connection pool settings
  pool: {
    max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
    min: parseInt(process.env.DB_POOL_MIN, 10) || 0,
    idle: parseInt(process.env.DB_POOL_IDLE, 10) || 10000,
    acquire: parseInt(process.env.DB_POOL_ACQUIRE, 10) || 30000,
    evict: parseInt(process.env.DB_POOL_EVICT, 10) || 1000,
  },
}));