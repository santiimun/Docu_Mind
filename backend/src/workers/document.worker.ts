import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { DOCUMENT_QUEUE_NAME } from '../queues/document.queue.js';
import prisma from '../config/prisma.js';
import fs from 'fs/promises';
import path from 'path';
import { splitTextIntoChunks } from '../utils/chunker.js';
import { createChunkWithEmbedding } from '../services/document.service.js';

// Importación del módulo
import pdfParseModule from 'pdf-parse';

// Helper para extraer texto de cualquier respuesta (string u objeto con .text/.data)
function extractStringFromResult(res: any): string | null {
  if (!res) return null;
  if (typeof res === 'string' && res.trim().length > 0) return res;
  if (typeof res.text === 'string' && res.text.trim().length > 0) return res.text;
  if (typeof res.data === 'string' && res.data.trim().length > 0) return res.data;
  return null;
}

// Helper para explorar los métodos de una instancia (v1, v2 o builds personalizados)
async function tryExtractFromInstance(instance: any): Promise<string | null> {
  if (!instance) return null;

  // 1. Verificar si la propiedad .text ya existe
  const directText = extractStringFromResult(instance);
  if (directText) return directText;

  // 2. Probar llamadas a métodos conocidos de la clase
  const methods = ['getText', 'parse', 'extractText', 'asText', 'load', 'execute'];
  for (const m of methods) {
    if (typeof instance[m] === 'function') {
      try {
        const res = await instance[m]();
        const text = extractStringFromResult(res);
        if (text) return text;
      } catch (_) {}
    }
  }

  // 3. Si la instancia es una Promesa o thenable
  if (typeof instance.then === 'function') {
    try {
      const res = await instance;
      const text = extractStringFromResult(res);
      if (text) return text;
    } catch (_) {}
  }

  return null;
}

// Extractor universal
async function extractPdfText(dataBuffer: Buffer): Promise<string> {
  const mod: any = pdfParseModule;

  // Recolectamos todas las funciones o clases exportadas
  const candidates: any[] = [
    mod,
    mod?.default,
    mod?.default?.default,
    mod?.PDFParse,
    mod?.default?.PDFParse,
    mod?.PdfParse,
    mod?.default?.PdfParse,
    mod?.pdfParse,
  ].filter((c) => typeof c === 'function');

  if (mod && typeof mod === 'object') {
    for (const key of Object.keys(mod)) {
      if (typeof mod[key] === 'function' && !candidates.includes(mod[key])) {
        candidates.push(mod[key]);
      }
    }
  }

  let lastError: any = null;

  for (const fnOrClass of candidates) {
    // 1. Intentar como función directa
    try {
      const res = await fnOrClass(dataBuffer);
      const text = extractStringFromResult(res);
      if (text) return text;
    } catch (err: any) {
      lastError = err;
    }

    // 2. Intentar como Clase (con distintas formas de pasar el buffer)
    const argVariants = [
      dataBuffer,
      { dataBuffer },
      { data: dataBuffer },
      { buffer: dataBuffer },
    ];

    for (const arg of argVariants) {
      try {
        const instance = new fnOrClass(arg);
        const text = await tryExtractFromInstance(instance);
        if (text) return text;
      } catch (err: any) {
        lastError = err;
      }
    }
  }

  throw new Error(`No se pudo extraer texto del PDF. Último error: ${lastError?.message || lastError}`);
}

interface DocumentJobData {
  documentId: string;
  filePath: string;
}

export const documentWorker = new Worker<DocumentJobData>(
  DOCUMENT_QUEUE_NAME,
  async (job: Job<DocumentJobData>) => {
    const { documentId, filePath } = job.data;

    console.log(`⚡ [Worker] Inicio de procesamiento para documento ID: ${documentId}`);

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' },
    });

    try {
      const absolutePath = path.resolve(filePath);
      const dataBuffer = await fs.readFile(absolutePath);

      // 1. Extracción de texto universal
      const extractedText = await extractPdfText(dataBuffer);

      // 2. Troceado (Chunking)
      const textChunks = splitTextIntoChunks(extractedText, {
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      console.log(`📄 [Worker] Texto troceado exitosamente en ${textChunks.length} chunks.`);

      // 3. Guardar fragmentos e inyectar embeddings con Gemini
      console.log(`🧠 [Worker] Generando embeddings y guardando en BD...`);
      for (let i = 0; i < textChunks.length; i++) {
        await createChunkWithEmbedding(documentId, i, textChunks[i]);
        console.log(`  └─ Chunk ${i + 1}/${textChunks.length} guardado con embedding vector.`);
      }

      // 4. Actualizar estado final a COMPLETED
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'COMPLETED' },
      });

      console.log(`✅ [Worker] Documento ID: ${documentId} procesado y guardado en DB.`);
    } catch (error) {
      console.error(`❌ [Worker] Error al procesar el archivo:`, error);

      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'FAILED' },
      });

      throw error;
    }
  },
  { connection: redisConnection }
);