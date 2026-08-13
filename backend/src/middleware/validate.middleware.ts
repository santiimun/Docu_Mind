import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Error de validación en la petición',
          details: error.issues.map((issue) => ({
            field: issue.path.join('.').replace(/^(body|query|params)\./, ''),
            message: issue.message,
          })),
        });
      }
      return res.status(500).json({ error: 'Error interno en la validación' });
    }
  };
};