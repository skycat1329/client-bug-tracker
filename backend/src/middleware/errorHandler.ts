import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode = 400, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If headers already sent, delegate to Express default handler
  if (res.headersSent) {
    return next(err);
  }

  // Zod validation error
  if (err instanceof ZodError) {
    const errorDetails = err.errors
      .map((e) => `${e.path.join('.') || 'field'}: ${e.message}`)
      .join('; ');
    res.status(400).json({
      success: false,
      error: `Validation failed: ${errorDetails}`,
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Known application error
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
    return;
  }

  // Multer error
  if (err.name === 'MulterError') {
    res.status(400).json({
      success: false,
      error: `File upload error: ${err.message}`,
    });
    return;
  }

  // Generic / Unexpected error
  const isDev = process.env.NODE_ENV !== 'production';
  console.error('[Unhandled Error]:', err);

  res.status(500).json({
    success: false,
    error: isDev ? err.message || 'Internal server error' : 'Internal server error',
  });
}
