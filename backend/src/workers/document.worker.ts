import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { DOCUMENT_QUEUE_NAME } from '../queues/document.queue.js';
import prisma from '../config/prisma.js';

interface DocumentJobData {
  documentId: string;
  filePath: string;
}

export const documentWorker = new Worker<DocumentJobData>(
  DOCUMENT_QUEUE_NAME,
  async (job: Job<DocumentJobData>) => {
    const { documentId, filePath } = job.data;

    console.log(`⚡ [Worker] Procesando documento ID: ${documentId} (${filePath})`);

    // Actualizamos el estado a PROCESSING
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' },
    });

    // Simulación de procesamiento (acá irá la extracción de texto)
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Actualizamos el estado a COMPLETED
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'COMPLETED' },
    });

    console.log(`✅ [Worker] Documento ID: ${documentId} procesado con éxito.`);
  },
  { connection: redisConnection }
);

documentWorker.on('completed', (job) => {
  console.log(`🎉 Job ${job.id} completado.`);
});

documentWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} falló con error:`, err);
});