import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import prisma from '../config/prisma';
import { generateEmbedding } from '../services/embedding.service';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function chatWithDocument(req: Request, res: Response) {
  try {
    const { documentId, sessionId, question } = req.body;

    if (!question || (!documentId && !sessionId)) {
      return res.status(400).json({
        error: 'Debes enviar "question" y al menos "documentId" o "sessionId"',
      });
    }

    let currentSessionId = sessionId;
    let targetDocumentId = documentId;

    // 1. Obtener o crear la sesión de chat
    if (!currentSessionId) {
      const newSession = await prisma.chatSession.create({
        data: {
          documentId: targetDocumentId,
          title: question.substring(0, 40) + '...',
        },
      });
      currentSessionId = newSession.id;
    } else {
      const session = await prisma.chatSession.findUnique({
        where: { id: currentSessionId },
      });

      if (!session) {
        return res.status(404).json({ error: 'Sesión de chat no encontrada.' });
      }
      targetDocumentId = session.documentId;
    }

    // 2. Traer el historial reciente (últimos 6 mensajes)
    const history = await prisma.chatMessage.findMany({
      where: { sessionId: currentSessionId },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    const formattedHistory = history
      .reverse()
      .map((msg) => `${msg.role === 'USER' ? 'Usuario' : 'Asistente'}: ${msg.content}`)
      .join('\n');

    // 3. Generar embedding de la pregunta actual y buscar los chunks con ID y contenido
    const questionEmbedding = await generateEmbedding(question);
    const vectorString = `[${questionEmbedding.join(',')}]`;

    const similarChunks: Array<{ id: string; content: string; similarity: number }> = await prisma.$queryRaw`
      SELECT id, content, 1 - (embedding <=> ${vectorString}::vector) as similarity
      FROM "DocumentChunk"
      WHERE "documentId" = ${targetDocumentId}
      ORDER BY embedding <=> ${vectorString}::vector
      LIMIT 4;
    `;

    if (!similarChunks || similarChunks.length === 0) {
      return res.status(404).json({ error: 'No se encontraron fragmentos para este documento.' });
    }

    // Preparamos los metadatos de las fuentes formateando la similitud a porcentaje
    const sources = similarChunks.map((chunk, index) => ({
      sourceId: index + 1,
      chunkId: chunk.id,
      snippet: chunk.content.length > 200 ? chunk.content.substring(0, 200) + '...' : chunk.content,
      similarityScore: `${(chunk.similarity * 100).toFixed(1)}%`,
    }));

    const contextText = similarChunks.map((chunk) => chunk.content).join('\n\n---\n\n');

    // 4. Prompt para Gemini con Contexto + Historial
    const prompt = `
Eres un asistente experto que responde preguntas basándote ÚNICAMENTE en el siguiente contexto del documento.
Usa el HISTORIAL DE LA CONVERSACIÓN para interpretar referencias implícitas o repreguntas del usuario.

CONTEXTO DEL DOCUMENTO:
${contextText}

HISTORIAL DE LA CONVERSACIÓN:
${formattedHistory || 'Sin historial previo.'}

PREGUNTA ACTUAL DEL USUARIO:
${question}
    `;

    // 5. Configurar headers HTTP para Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 6. Enviar mensaje inicial con metadatos de la sesión Y LAS FUENTES/CITAS UTILIZADAS
    res.write(
      `data: ${JSON.stringify({
        type: 'start',
        sessionId: currentSessionId,
        sourcesUsed: sources.length,
        sources: sources,
      })}\n\n`
    );

    // 7. Usar generateContentStream para enviar la respuesta por fragmentos
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3.5-flash',
      contents: prompt,
    });

    let fullAnswerText = '';

    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullAnswerText += chunkText;
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`);
      }
    }

    // 8. Guardar la interacción en la base de datos
    await prisma.$transaction([
      prisma.chatMessage.create({
        data: {
          sessionId: currentSessionId,
          role: 'USER',
          content: question,
        },
      }),
      prisma.chatMessage.create({
        data: {
          sessionId: currentSessionId,
          role: 'ASSISTANT',
          content: fullAnswerText,
        },
      }),
    ]);

    // 9. Enviar evento final de cierre
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Error en chatWithDocument:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Error al procesar la consulta' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Error durante el streaming' })}\n\n`);
      res.end();
    }
  }
}

export async function getDocumentSessions(req: Request, res: Response) {
  try {
    const { documentId } = req.params as { documentId: string };

    const sessions = await prisma.chatSession.findMany({
      where: { documentId },
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
    });

    return res.json(sessions);
  } catch (error) {
    console.error('Error en getDocumentSessions:', error);
    return res.status(500).json({ error: 'Error al obtener las sesiones del documento' });
  }
}

export async function getSessionMessages(req: Request, res: Response) {
  try {
    const { sessionId } = req.params as { sessionId: string };

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });

    return res.json(messages);
  } catch (error) {
    console.error('Error en getSessionMessages:', error);
    return res.status(500).json({ error: 'Error al obtener los mensajes de la sesión' });
  }
}

