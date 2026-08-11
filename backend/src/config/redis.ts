import 'dotenv/config';

export const redisConnection = {
  host: process.env['REDIS_HOST'],
  port: Number(process.env['REDIS_PORT']),
};