import { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('❌ Error capturado en Middleware Global:', err.message || err);

  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'El archivo es demasiado grande. El límite máximo permitido es de 10 MB.',
      });
    }
    return res.status(400).json({ error: `Error en la subida del archivo: ${err.message}` });
  }

  if (err.message && err.message.includes('Formato no permitido')) {
    return res.status(400).json({ error: err.message });
  }

  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    error: err.message || 'Ocurrió un error interno en el servidor.',
  });
}