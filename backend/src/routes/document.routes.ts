import { Router } from 'express';
import { uploadDocument } from '../controllers/document.controller.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// POST /api/documents/upload
router.post('/upload', upload.single('file'), uploadDocument);

export default router;