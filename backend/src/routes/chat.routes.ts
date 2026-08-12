import { Router } from 'express';
import { chatWithDocument } from '../controllers/chat.controller';

const router = Router();

// POST /api/chat
router.post('/', chatWithDocument);

export default router;