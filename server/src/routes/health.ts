import { Router, Request, Response } from 'express';
import { getDBStatus } from '../config/db';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'SmartBuild API endpoints active',
    timestamp: new Date().toISOString(),
  });
});

router.get('/health', (_req: Request, res: Response) => {
  const db = getDBStatus();

  res.status(200).json({
    status: 'ok',
    server: 'running',
    database: {
      connected: db.connected,
      status: db.connected ? 'connected' : 'disconnected',
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
