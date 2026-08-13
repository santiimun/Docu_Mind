import { Router } from 'express';
import {
  chatWithDocument,
  getDocumentSessions,
  getSessionMessages,
} from '../controllers/chat.controller';

const router = Router();

// Endpoint para enviar preguntas
router.post('/', chatWithDocument);

// Endpoints para recuperar historial y sesiones
router.get('/sessions/:documentId', getDocumentSessions);
router.get('/messages/:sessionId', getSessionMessages);

export default router;