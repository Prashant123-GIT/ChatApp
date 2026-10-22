import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Unhandled Application Error:', err);

  const message = err.message || 'Internal server error';

  if (
    message.includes('not found') ||
    message.includes('does not exist')
  ) {
    res.status(404).json({ success: false, error: message });
    return;
  }

  if (
    message.includes('not a member') ||
    message.includes('Only a group admin') ||
    message.includes('Only the sender') ||
    message.includes('Cannot create a 1:1 chat with oneself') ||
    message.includes('already exists') ||
    message.includes('empty') ||
    message.includes('Cannot edit')
  ) {
    res.status(400).json({ success: false, error: message });
    return;
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: message }),
  });
}
