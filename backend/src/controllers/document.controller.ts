import { Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { documentQueue } from '../queues/document.queue.js'; 

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

export async function getAllDocuments(req: Request, res: Response) {
  try {
    const documents = await prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        originalName: true,
        size: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            chunks: true,
            sessions: true,
          },
        },
      },
    });

    return res.json(documents);
  } catch (error) {
    console.error('Error en getAllDocuments:', error);
    return res.status(500).json({ error: 'Error al obtener los documentos' });
  }
}

export async function getDocumentById(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        sessions: {
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: { messages: true },
            },
          },
        },
        _count: {
          select: { chunks: true },
        },
      },
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    return res.json(document);
  } catch (error) {
    console.error('Error en getDocumentById:', error);
    return res.status(500).json({ error: 'Error al obtener el detalle del documento' });
  }
}

export async function deleteDocument(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };

    const existingDocument = await prisma.document.findUnique({
      where: { id },
    });

    if (!existingDocument) {
      return res.status(404).json({ error: 'El documento no existe' });
    }

    // Eliminamos el documento (Prisma/PostgreSQL se encarga del cascade si está en el schema,
    // o podemos hacerlo explícito si hiciera falta)
    await prisma.document.delete({
      where: { id },
    });

    return res.json({
      message: 'Documento y todos sus datos asociados fueron eliminados correctamente',
      deletedDocumentId: id,
    });
  } catch (error) {
    console.error('Error en deleteDocument:', error);
    return res.status(500).json({ error: 'Error al eliminar el documento' });
  }
}
