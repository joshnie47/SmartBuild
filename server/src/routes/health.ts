import { Router, Request, Response } from 'express';
import { getDBStatus } from '../config/db';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  const db = getDBStatus();

  res.status(db.connected ? 200 : 503).json({
    status: db.connected ? 'ok' : 'error',
    server: 'running',
    database: {
      connected: db.connected,
      host: db.host,
      name: db.dbName,
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
