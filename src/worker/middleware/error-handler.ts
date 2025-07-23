// Global error handling middleware

import { Context } from 'hono';
import { ApiError } from '../types/api';

export async function errorHandler(err: Error, c: Context) {
  console.error('Unhandled error:', err);

  // Check for specific error types
  if (err.message.includes('Invalid credentials')) {
    return c.json<ApiError>({ error: err.message }, 401);
  }

  if (err.message.includes('already exists')) {
    return c.json<ApiError>({ error: err.message }, 409);
  }

  if (err.message.includes('not found')) {
    return c.json<ApiError>({ error: err.message }, 404);
  }

  // Check for validation errors
  if (err.message.includes('required') || err.message.includes('invalid')) {
    return c.json<ApiError>({ 
      error: 'Validation failed',
      details: { message: err.message }
    }, 400);
  }

  // Default error response
  return c.json<ApiError>({ 
    error: 'An unexpected error occurred',
    details: c.env.ENVIRONMENT === 'development' ? { message: err.message } : undefined
  }, 500);
}