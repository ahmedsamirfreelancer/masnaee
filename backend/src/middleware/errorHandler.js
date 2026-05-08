export function errorHandler(err, req, res, _next) {
  console.error('Error:', err.message, err.stack);
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? 'حدث خطأ في الخادم' : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}
