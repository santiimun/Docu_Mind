import { z } from 'zod';

export const chatQuerySchema = z.object({
  body: z
    .object({
      documentId: z.string().uuid('El documentId debe ser un UUID válido').optional(),
      sessionId: z.string().uuid('El sessionId debe ser un UUID válido').optional(),
      question: z
        .string()
        .min(1, 'La pregunta no puede estar vacía')
        .max(1000, 'La pregunta no puede superar los 1000 caracteres'),
    })
    .refine((data) => data.documentId || data.sessionId, {
      message: 'Debes enviar al menos "documentId" o "sessionId"',
      path: ['documentId'],
    }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('El ID proporcionado no es un UUID válido'),
  }),
});