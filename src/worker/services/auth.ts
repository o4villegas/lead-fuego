// Authentication service with JWT handling

import { SignJWT, jwtVerify } from 'jose';
import { User } from '../types/database';
import { JwtPayload } from '../types/api';
import { hashPassword, verifyPassword, generateId } from '../utils/crypto';
import { DatabaseService } from './database';

export class AuthService {
  private readonly JWT_ALGORITHM = 'HS256';
  private readonly JWT_EXPIRATION = '7d';
  
  constructor(
    private db: DatabaseService,
    private jwtSecret: string
  ) {}

  async createUser(
    email: string, 
    password: string, 
    firstName?: string, 
    lastName?: string, 
    company?: string
  ): Promise<User> {
    // Check if user already exists
    const existingUser = await this.db.getUserByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const userId = await generateId();
    
    const user: User = {
      id: userId,
      email: email.toLowerCase(),
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      company,
      subscription_tier: 'free',
      onboarding_completed: false,
      is_active: true,
      created_at: Date.now(),
      updated_at: Date.now()
    };

    await this.db.createUser(user);
    return user;
  }

  async authenticateUser(email: string, password: string): Promise<User> {
    const user = await this.db.getUserByEmail(email.toLowerCase());
    
    if (!user || !user.is_active) {
      throw new Error('Invalid credentials');
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    return user;
  }

  async generateJWT(user: User): Promise<string> {
    const secret = new TextEncoder().encode(this.jwtSecret);
    
    const jwt = await new SignJWT({
      userId: user.id,
      email: user.email
    })
      .setProtectedHeader({ alg: this.JWT_ALGORITHM })
      .setIssuedAt()
      .setExpirationTime(this.JWT_EXPIRATION)
      .sign(secret);

    return jwt;
  }

  async verifyJWT(token: string): Promise<JwtPayload> {
    try {
      const secret = new TextEncoder().encode(this.jwtSecret);
      const { payload } = await jwtVerify(token, secret);
      return {
        userId: payload.userId as string,
        email: payload.email as string,
        iat: payload.iat as number,
        exp: payload.exp as number
      };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async getUserFromToken(token: string): Promise<User | null> {
    try {
      const payload = await this.verifyJWT(token);
      return await this.db.getUserById(payload.userId);
    } catch {
      return null;
    }
  }
}