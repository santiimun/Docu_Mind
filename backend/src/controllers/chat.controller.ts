import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import prisma from '../config/prisma';
import { generateEmbedding } from '../services/embedding.service';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function chatWithDocument(req: Request, res: Response) {
  try {
    const { documentId, question } = req.body;

    if (!documentId || !question) {
      return res.status(400).json({ error: 'Faltan documentId o question' });
    }

    // 1. Generar embedding de la pregunta (1536 dims)
    const questionEmbedding = await generateEmbedding(question);
    const vectorString = `[${questionEmbedding.join(',')}]`;

    // 2. Búsqueda vectorial en PostgreSQL por distancia coseno
    const similarChunks: Array<{ content: string; similarity: number }> = await prisma.$queryRaw`
      SELECT content, 1 - (embedding <=> ${vectorString}::vector) as similarity
      FROM "DocumentChunk"
      WHERE "documentId" = ${documentId}
      ORDER BY embedding <=> ${vectorString}::vector
      LIMIT 4;
    `;

    if (!similarChunks || similarChunks.length === 0) {
      return res.status(404).json({ error: 'No se encontraron fragmentos para este documento.' });
    }

    // 3. Unir el contexto de los chunks
    const contextText = similarChunks.map((chunk) => chunk.content).join('\n\n---\n\n');

    // 4. Prompt para Gemini
    const prompt = `
Eres un asistente que responde preguntas basándote ÚNICAMENTE en la siguiente información de contexto proporcionada.
Si la respuesta no está en el contexto, di amablemente que no encuentras esa información en el documento.

CONTEXTO DEL DOCUMENTO:
${contextText}

PREGUNTA DEL USUARIO:
${question}
    `;

    // 5. Generar respuesta
    const response = await ai.models.generateContent({
  model: 'gemini-3.5-flash',
  contents: prompt,
});

    return res.json({
      answer: response.text,
      sourcesUsed: similarChunks.length,
    });
  } catch (error) {
    console.error('Error en chatWithDocument:', error);
    return res.status(500).json({ error: 'Error al procesar la consulta' });
  }
}