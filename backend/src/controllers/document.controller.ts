import { Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { documentQueue } from '../queues/document.queue.js'; // 👈 Importar la cola

export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No se ha adjuntado ningún archivo PDF' });
      return;
    }

    const userId = req.body.userId;

    if (!userId) {
      res.status(400).json({ error: 'Se requiere un userId en el body para vincular el documento' });
      return;
    }

    // 1. Guardar metadatos en la DB
    const document = await prisma.document.create({
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        filePath: req.file.path,
        userId: userId,
      },
    });

    // 2. Encolar trabajo en BullMQ para procesamiento en 2do plano 🚀
    await documentQueue.add('process-pdf', {
      documentId: document.id,
      filePath: document.filePath,
    });

    res.status(201).json({
      message: 'Documento subido y enviado a la cola de procesamiento',
      document,
    });
  } catch (error) {
    console.error('Error al guardar documento:', error);
    res.status(500).json({ error: 'Error interno del servidor al procesar el archivo' });
  }
};