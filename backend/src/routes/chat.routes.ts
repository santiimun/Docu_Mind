import { Router } from 'express';
import {
  chatWithDocument,
  getDocumentSessions,
  getSessionMessages,
} from '../controllers/chat.controller';
import { validate } from '../middleware/validate.middleware';
import { chatQuerySchema, idParamSchema } from '../schemas/chat.schema';

const router = Router();

// Endpoint para enviar preguntas
router.post('/', chatWithDocument);

// Endpoints para recuperar historial y sesiones
router.post('/', validate(chatQuerySchema), chatWithDocument);
router.get('/document/:documentId', validate(idParamSchema), getDocumentSessions);
router.get('/messages/:sessionId', validate(idParamSchema), getSessionMessages);

export default router;