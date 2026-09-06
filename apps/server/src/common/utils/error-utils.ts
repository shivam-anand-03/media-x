export class AppError extends Error {
  public readonly details: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    isOperational = true,
    details?: any,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: any) {
    super(message, 400, true, details);
  }
}

export class AuthError extends AppError {
  constructor(message = "Authentication failed", details?: any) {
    super(message, 401, true, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access forbidden", details?: any) {
    super(message, 403, true, details);
  }
}

export class DatabaseError extends AppError {
  constructor(message = "Database operation failed", details?: any) {
    super(message, 500, false, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests", details?: any) {
    super(message, 429, true, details);
  }
}

export class TokenError extends AppError {
  constructor(message = "Invalid or expired token", details?: any) {
    super(message, 498, true, details);
  }
}
