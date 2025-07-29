import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, uuid, text, boolean, timestamp, withReplicas } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';

export const tasksTable = pgTable('tasks', {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    completed: boolean('completed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

const primaryPool = new Pool({
    host: process.env.DB_HOST_MAIN,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 5432
});

const replica1Pool = new Pool({
    host: process.env.DB_HOST_REPLICA1,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 5432
});

const replica2Pool = new Pool({
    host: process.env.DB_HOST_REPLICA2,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 5432
});

const primaryDb = drizzle(primaryPool);
const read1 = drizzle(replica1Pool);
const read2 = drizzle(replica2Pool);

export const db = withReplicas(primaryDb, [read1, read2]);
export const replica1Db = read1;
export const replica2Db = read2; 