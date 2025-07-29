import { defineConfig } from 'drizzle-kit';
import type { Config } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
    schema: './src/database.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        host: process.env.DB_HOST_MAIN || 'localhost',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'example',
        database: process.env.DB_NAME || 'appdb',
        port: 5432,
    },
}); 