import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const waitForDatabase = async (pool: Pool, maxRetries = 30, delay = 2000): Promise<void> => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await pool.query('SELECT 1');
            console.log('Database is ready');
            return;
        } catch (error) {
            console.log(`Database not ready, attempt ${i + 1}/${maxRetries}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error('Database connection timeout');
};

const runMigrations = async () => {
    const pool = new Pool({
        host: process.env.DB_HOST_MAIN,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: 5432,
    });

    const db = drizzle(pool);

    try {
        console.log('Waiting for database to be ready...');
        await waitForDatabase(pool);

        console.log('Running migrations...');
        await migrate(db, { migrationsFolder: './drizzle' });
        console.log('Migrations completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        await pool.end();
    }
};

export { runMigrations }; 