import prisma from '../config/prisma.js';
import { generateEmbedding } from './embedding.service.js';

/**
 * Guarda un fragmento (chunk) de documento en la base de datos
 * junto con su vector generado por Gemini.
 */
export async function createChunkWithEmbedding(
  documentId: string,
  chunkIndex: number,
  content: string
) {
  // 1. Generamos el vector con Gemini (768 dimensiones)
  const vector = await generateEmbedding(content);

  // 2. Lo formateamos para PostgreSQL: "[0.12, -0.45, ...]"
  const vectorString = `[${vector.join(',')}]`;

  // 3. Guardamos el registro base en Prisma
  const chunk = await prisma.documentChunk.create({
    data: {
      documentId,
      chunkIndex,
      content,
    },
  });

  // 4. Inyectamos el vector en PostgreSQL usando SQL Raw
  await prisma.$executeRawUnsafe(
    `UPDATE "DocumentChunk" SET embedding = $1::vector WHERE id = $2`,
    vectorString,
    chunk.id
  );

  return chunk;
}