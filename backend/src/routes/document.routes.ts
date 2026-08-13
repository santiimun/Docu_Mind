import { Router } from 'express';
import { uploadDocument, getAllDocuments, getDocumentById, deleteDocument } from '../controllers/document.controller.js';
import { upload } from '../middleware/upload.js';

const router = Router();

//   /api/documents/
router.post('/upload', upload.single('file'), uploadDocument);
router.get('/', getAllDocuments);
router.get('/:id', getDocumentById);
router.delete('/:id', deleteDocument);

export default router;