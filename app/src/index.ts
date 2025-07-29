import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { fastifySwagger } from '@fastify/swagger';
import { fastifySwaggerUi } from '@fastify/swagger-ui';
import { eq } from 'drizzle-orm';
import { db, replica1Db, replica2Db, tasksTable } from './database.js';
import { runMigrations } from './migrate.js';

const app = Fastify();

await app.register(fastifySwagger, {
    swagger: {
        info: {
            title: 'Tasks API',
            description: 'API for managing tasks with PostgreSQL replication',
            version: '1.0.0'
        },
        host: 'localhost:3000',
        schemes: ['http'],
        consumes: ['application/json'],
        produces: ['application/json'],
        tags: [
            { name: 'tasks', description: 'Task management endpoints' },
            { name: 'health', description: 'Health check endpoints' }
        ]
    }
});

await app.register(fastifySwaggerUi, {
    routePrefix: '/documentation'
});

const PORT = Number(process.env.PORT) || 3000;

interface CreateTaskBody {
    title: string;
}

interface UpdateTaskBody {
    title?: string;
    completed?: boolean;
}

interface TaskParams {
    id: string;
}

const taskSchema = {
    type: 'object',
    properties: {
        id: { type: 'string', format: 'uuid' },
        title: { type: 'string' },
        completed: { type: 'boolean' },
        createdAt: { type: 'string', format: 'date-time' }
    }
};

const createTaskSchema = {
    type: 'object',
    required: ['title'],
    properties: {
        title: { type: 'string', minLength: 1 }
    }
};

const updateTaskSchema = {
    type: 'object',
    properties: {
        title: { type: 'string', minLength: 1 },
        completed: { type: 'boolean' }
    }
};

app.get('/tasks', {
    schema: {
        tags: ['tasks'],
        summary: 'Get all tasks',
        description: 'Retrieve all tasks from the database (distributed between replicas)',
        response: {
            200: {
                type: 'array',
                items: taskSchema
            },
            500: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                }
            }
        }
    }
}, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const tasks = await db.select().from(tasksTable);
        reply.send(tasks);
    } catch (err) {
        reply.status(500).send({ error: (err as Error).message });
    }
});

app.get('/tasks/replica1', {
    schema: {
        tags: ['tasks'],
        summary: 'Get tasks from replica 1',
        description: 'Retrieve tasks from replica 1 (immediate sync)',
        response: {
            200: {
                type: 'object',
                properties: {
                    source: { type: 'string' },
                    tasks: {
                        type: 'array',
                        items: taskSchema
                    }
                }
            },
            500: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                }
            }
        }
    }
}, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const tasks = await replica1Db.select().from(tasksTable);
        reply.send({ source: 'replica1', tasks });
    } catch (err) {
        reply.status(500).send({ error: (err as Error).message });
    }
});

app.get('/tasks/replica2', {
    schema: {
        tags: ['tasks'],
        summary: 'Get tasks from replica 2',
        description: 'Retrieve tasks from replica 2 (1-minute delay)',
        response: {
            200: {
                type: 'object',
                properties: {
                    source: { type: 'string' },
                    tasks: {
                        type: 'array',
                        items: taskSchema
                    }
                }
            },
            500: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                }
            }
        }
    }
}, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const tasks = await replica2Db.select().from(tasksTable);
        reply.send({ source: 'replica2', tasks });
    } catch (err) {
        reply.status(500).send({ error: (err as Error).message });
    }
});

app.post('/tasks', {
    schema: {
        tags: ['tasks'],
        summary: 'Create a new task',
        description: 'Create a new task in the database',
        body: createTaskSchema,
        response: {
            201: taskSchema,
            500: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                }
            }
        }
    }
}, async (request: FastifyRequest<{ Body: CreateTaskBody }>, reply: FastifyReply) => {
    const { title } = request.body;
    try {
        const [task] = await db.insert(tasksTable).values({ title }).returning();
        reply.code(201).send(task);
    } catch (err) {
        reply.status(500).send({ error: (err as Error).message });
    }
});

app.put('/tasks/:id', {
    schema: {
        tags: ['tasks'],
        summary: 'Update a task',
        description: 'Update an existing task by ID',
        params: {
            type: 'object',
            required: ['id'],
            properties: {
                id: { type: 'string', format: 'uuid' }
            }
        },
        body: updateTaskSchema,
        response: {
            200: taskSchema,
            500: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                }
            }
        }
    }
}, async (request: FastifyRequest<{ Body: UpdateTaskBody, Params: TaskParams }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { title, completed } = request.body;
    try {
        const [task] = await db.update(tasksTable)
            .set({ title, completed })
            .where(eq(tasksTable.id, id))
            .returning();
        reply.send(task);
    } catch (err) {
        reply.status(500).send({ error: (err as Error).message });
    }
});

app.delete('/tasks/:id', {
    schema: {
        tags: ['tasks'],
        summary: 'Delete a task',
        description: 'Delete a task by ID',
        params: {
            type: 'object',
            required: ['id'],
            properties: {
                id: { type: 'string', format: 'uuid' }
            }
        },
        response: {
            204: {
                type: 'null'
            },
            500: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                }
            }
        }
    }
}, async (request: FastifyRequest<{ Params: TaskParams }>, reply: FastifyReply) => {
    const { id } = request.params;
    try {
        await db.delete(tasksTable).where(eq(tasksTable.id, id));
        reply.code(204).send();
    } catch (err) {
        reply.status(500).send({ error: (err as Error).message });
    }
});

app.get('/health', {
    schema: {
        tags: ['health'],
        summary: 'Health check',
        description: 'Check if the API is running',
        response: {
            200: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' }
                }
            }
        }
    }
}, async (request: FastifyRequest, reply: FastifyReply) => {
    reply.send({ status: 'OK', timestamp: new Date().toISOString() });
});

const startServer = async () => {
    try {
        await runMigrations();

        app.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
            if (err) {
                console.error(err);
                process.exit(1);
            }
            console.log(`Server running at http://localhost:${PORT}`);
            console.log(`Swagger documentation available at http://localhost:${PORT}/documentation`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer(); 