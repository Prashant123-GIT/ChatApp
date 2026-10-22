import { app } from './app';
import { env } from './config/env';
import { runMigrations } from './db/migrate';
import { initFirebase } from './config/firebase';
import { pool } from './db/pool';

async function bootstrap() {
  try {
    console.log('--- Initializing Chat Backend ---');
    console.log(`Environment: ${env.NODE_ENV}`);

    // Run PostgreSQL migrations
    await runMigrations();

    // Initialize Firebase
    initFirebase();

    // Start server
    const server = app.listen(env.PORT, () => {
      console.log(` Chat Backend Server is running at http://localhost:${env.PORT}`);
      console.log(` PostgreSQL connected to database: ${env.PGDATABASE}`);
      console.log(` Health check available at: http://localhost:${env.PORT}/health`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        console.log('HTTP server closed.');
        await pool.end();
        console.log('PostgreSQL connection pool closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

bootstrap();
