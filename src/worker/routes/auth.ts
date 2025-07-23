// Authentication routes - register, login, profile

import { Hono } from 'hono';
import { z } from 'zod';
import { Env } from '../types/env';
import { AuthRequest, RegisterRequest, AuthResponse } from '../types/api';
import { AuthService } from '../services/auth';
import { DatabaseService } from '../services/database';
import { authMiddleware } from '../middleware/auth';

// Validation schemas
const loginSchema = z.object({
  email: z.string().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required')
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional()
});

export const authRoutes = new Hono<{ Bindings: Env }>();

// POST /api/auth/register
authRoutes.post('/register', async (c) => {
  try {
    // Parse and validate request body
    const body = await c.req.json<RegisterRequest>();
    const validated = registerSchema.parse(body);
    
    // Initialize services
    const db = new DatabaseService(c.env.DB);
    const authService = new AuthService(db, c.env.JWT_SECRET);
    
    // Create user
    const user = await authService.createUser(
      validated.email,
      validated.password,
      validated.firstName,
      validated.lastName,
      validated.company
    );
    
    // Generate JWT token
    const token = await authService.generateJWT(user);
    
    // Return success response
    const response: AuthResponse = {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        company: user.company,
        subscriptionTier: user.subscription_tier,
        onboardingCompleted: user.onboarding_completed
      }
    };
    
    return c.json(response, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        success: false, 
        error: 'Validation failed', 
        details: error.errors 
      }, 400);
    }
    
    if (error instanceof Error && error.message.includes('already exists')) {
      return c.json({ 
        success: false, 
        error: 'User with this email already exists' 
      }, 409);
    }
    
    console.error('Registration error:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to create account' 
    }, 500);
  }
});

// POST /api/auth/login
authRoutes.post('/login', async (c) => {
  try {
    // Parse and validate request body
    const body = await c.req.json<AuthRequest>();
    const validated = loginSchema.parse(body);
    
    // Initialize services
    const db = new DatabaseService(c.env.DB);
    const authService = new AuthService(db, c.env.JWT_SECRET);
    
    // Authenticate user
    const user = await authService.authenticateUser(
      validated.email,
      validated.password
    );
    
    // Generate JWT token
    const token = await authService.generateJWT(user);
    
    // Return success response
    const response: AuthResponse = {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        company: user.company,
        subscriptionTier: user.subscription_tier,
        onboardingCompleted: user.onboarding_completed
      }
    };
    
    return c.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        success: false, 
        error: 'Invalid email or password format' 
      }, 400);
    }
    
    if (error instanceof Error && error.message.includes('Invalid credentials')) {
      return c.json({ 
        success: false, 
        error: 'Invalid email or password' 
      }, 401);
    }
    
    console.error('Login error:', error);
    return c.json({ 
      success: false, 
      error: 'Login failed' 
    }, 500);
  }
});

// GET /api/auth/profile (protected route)
authRoutes.get('/profile', authMiddleware, async (c) => {
  const user = c.get('user');
  
  const response: AuthResponse = {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      company: user.company,
      subscriptionTier: user.subscription_tier,
      onboardingCompleted: user.onboarding_completed
    }
  };
  
  return c.json(response);
});

// PUT /api/auth/profile (protected route)
authRoutes.put('/profile', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    
    // Validate updateable fields
    const updateSchema = z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      company: z.string().optional(),
      metaAdAccountId: z.string().optional()
    });
    
    const validated = updateSchema.parse(body);
    
    // Map to database fields
    const updates: any = {};
    if (validated.firstName !== undefined) updates.first_name = validated.firstName;
    if (validated.lastName !== undefined) updates.last_name = validated.lastName;
    if (validated.company !== undefined) updates.company = validated.company;
    if (validated.metaAdAccountId !== undefined) updates.meta_ad_account_id = validated.metaAdAccountId;
    
    // Update user in database
    const db = new DatabaseService(c.env.DB);
    await db.updateUser(user.id, updates);
    
    // Get updated user
    const updatedUser = await db.getUserById(user.id);
    
    const response: AuthResponse = {
      success: true,
      user: {
        id: updatedUser!.id,
        email: updatedUser!.email,
        firstName: updatedUser!.first_name,
        lastName: updatedUser!.last_name,
        company: updatedUser!.company,
        subscriptionTier: updatedUser!.subscription_tier,
        onboardingCompleted: updatedUser!.onboarding_completed
      }
    };
    
    return c.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        success: false, 
        error: 'Invalid update data',
        details: error.errors 
      }, 400);
    }
    
    console.error('Profile update error:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to update profile' 
    }, 500);
  }
});