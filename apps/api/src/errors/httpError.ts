export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public error: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'HttpError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(404, 'Not Found', message, details);
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(message = 'Unprocessable Entity', details?: unknown) {
    super(422, 'Unprocessable Entity', message, details);
  }
}

export class RateLimitExceededError extends HttpError {
  constructor(message = 'Rate limit exceeded', details?: unknown) {
    super(429, 'Rate Limit Exceeded', message, details);
  }
}

export class BadGatewayError extends HttpError {
  constructor(message = 'Upstream service error', details?: unknown) {
    super(502, 'Bad Gateway', message, details);
  }
}

export class GatewayTimeoutError extends HttpError {
  constructor(message = 'Upstream service timed out', details?: unknown) {
    super(504, 'Gateway Timeout', message, details);
  }
}
