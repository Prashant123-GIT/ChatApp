import { Router } from 'express';
import userRoutes from './user.routes';
import chatRoutes from './chat.routes';
import { pool } from '../db/pool';
import { isFirestoreMock } from '../config/firebase';

const router = Router();

router.get('/health', async (_req, res) => {
  let dbHealthy = false;
  try {
    const dbRes = await pool.query('SELECT 1 as healthy');
    dbHealthy = dbRes.rows[0]?.healthy === 1;
  } catch (err) {
    dbHealthy = false;
  }

  res.status(dbHealthy ? 200 : 503).json({
    status: dbHealthy ? 'ok' : 'degraded',
    database: {
      type: 'PostgreSQL',
      healthy: dbHealthy,
    },
    firestore: {
      mode: isFirestoreMock() ? 'in-memory-fallback' : 'firebase-cloud-firestore',
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

router.use('/', userRoutes);
router.use('/', chatRoutes);

export default router;
