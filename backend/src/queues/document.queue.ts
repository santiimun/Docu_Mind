import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';

// Definimos el nombre de la cola
export const DOCUMENT_QUEUE_NAME = 'document-processing';

// Creamos la instancia de la cola
export const documentQueue = new Queue(DOCUMENT_QUEUE_NAME, {
  connection: redisConnection,
});