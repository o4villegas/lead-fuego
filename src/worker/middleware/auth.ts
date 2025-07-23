// Authentication middleware for protected routes

import { Context, Next } from 'hono';
import { AuthService } from '../services/auth';
import { DatabaseService } from '../services/database';
import { Env } from '../types/env';
import { User } from '../types/database';

// Extend Hono context to include authenticated user
declare module 'hono' {
  interface ContextVariableMap {
    user: User;
  }
}

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  try {
    // Get token from Authorization header
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid authorization header' }, 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Initialize services
    const db = new DatabaseService(c.env.DB);
    const authService = new AuthService(db, c.env.JWT_SECRET);
    
    // Verify token and get user
    const user = await authService.getUserFromToken(token);
    if (!user || !user.is_active) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Add user to context for use in route handlers
    c.set('user', user);
    
    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
}

// Optional auth middleware - doesn't require auth but adds user if available
export async function optionalAuthMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  try {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const db = new DatabaseService(c.env.DB);
      const authService = new AuthService(db, c.env.JWT_SECRET);
      const user = await authService.getUserFromToken(token);
      if (user && user.is_active) {
        c.set('user', user);
      }
    }
  } catch (error) {
    // Silent fail - user just won't be authenticated
    console.error('Optional auth error:', error);
  }
  
  await next();
}