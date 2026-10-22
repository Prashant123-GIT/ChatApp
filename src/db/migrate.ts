import fs from 'fs';
import path from 'path';
import { pool } from './pool';

export async function runMigrations(): Promise<void> {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  console.log('Running database migrations...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(schemaSql);
    await client.query('COMMIT');
    console.log('Database migrations completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error running migrations:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Migration failed:', err);
      await pool.end();
      process.exit(1);
    });
}
