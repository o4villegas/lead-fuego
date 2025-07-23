/**
 * Comprehensive Logging System for LeadFuego
 * Provides structured logging with different levels and contexts
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogContext {
  userId?: string;
  requestId?: string;
  campaignId?: string;
  leadId?: string;
  service?: string;
  action?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: Error;
  duration?: number;
}

class Logger {
  private minLevel: LogLevel;
  private requestId?: string;

  constructor(minLevel: LogLevel = LogLevel.INFO) {
    this.minLevel = minLevel;
  }

  setRequestId(requestId: string) {
    this.requestId = requestId;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  private formatLogEntry(entry: LogEntry): string {
    const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
    const contextStr = Object.keys(entry.context).length > 0 
      ? ` | Context: ${JSON.stringify(entry.context)}`
      : '';
    
    const durationStr = entry.duration ? ` | Duration: ${entry.duration}ms` : '';
    const errorStr = entry.error ? ` | Error: ${entry.error.message}` : '';

    return `[${entry.timestamp}] ${levelNames[entry.level]} | ${entry.message}${contextStr}${durationStr}${errorStr}`;
  }

  private log(level: LogLevel, message: string, context: LogContext = {}, error?: Error, duration?: number) {
    if (!this.shouldLog(level)) return;

    // Add request ID to context if available
    if (this.requestId) {
      context.requestId = this.requestId;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
      duration
    };

    const formattedMessage = this.formatLogEntry(entry);
    
    // Log to console with appropriate method
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formattedMessage);
        if (error) {
          console.error(error.stack);
        }
        break;
    }

    // In production, you might want to send critical logs to external service
    if (level >= LogLevel.ERROR) {
      this.sendToExternalService(entry);
    }
  }

  private async sendToExternalService(_entry: LogEntry) {
    // TODO: Integrate with external logging service (e.g., Sentry, DataDog)
    // For now, just store in console
    try {
      // Example: Send to webhook endpoint or logging service
      // await fetch('/api/logs', {
      //   method: 'POST',
      //   body: JSON.stringify(_entry)
      // });
    } catch (error) {
      console.error('Failed to send log to external service:', error);
    }
  }

  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log(LogLevel.ERROR, message, context, error);
  }

  fatal(message: string, error?: Error, context?: LogContext) {
    this.log(LogLevel.FATAL, message, context, error);
  }

  // Performance logging
  time(label: string, context?: LogContext): () => void {
    const startTime = Date.now();
    this.debug(`Timer started: ${label}`, context);
    
    return () => {
      const duration = Date.now() - startTime;
      this.log(LogLevel.INFO, `Timer completed: ${label}`, context, undefined, duration);
    };
  }

  // API request logging
  apiRequest(method: string, endpoint: string, context?: LogContext) {
    this.info(`API Request: ${method} ${endpoint}`, {
      ...context,
      service: 'api',
      action: 'request'
    });
  }

  apiResponse(method: string, endpoint: string, status: number, duration: number, context?: LogContext) {
    const level = status >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    this.log(level, `API Response: ${method} ${endpoint} - ${status}`, {
      ...context,
      service: 'api',
      action: 'response',
      status
    }, undefined, duration);
  }

  // Database operation logging
  dbQuery(query: string, params?: any[], context?: LogContext) {
    this.debug(`DB Query: ${query}`, {
      ...context,
      service: 'database',
      action: 'query',
      params: params?.length || 0
    });
  }

  dbError(query: string, error: Error, context?: LogContext) {
    this.error(`DB Error: ${query}`, error, {
      ...context,
      service: 'database',
      action: 'error'
    });
  }

  // Business logic logging
  campaignAction(action: string, campaignId: string, context?: LogContext) {
    this.info(`Campaign ${action}`, {
      ...context,
      campaignId,
      service: 'campaign',
      action
    });
  }

  leadAction(action: string, leadId: string, context?: LogContext) {
    this.info(`Lead ${action}`, {
      ...context,
      leadId,
      service: 'lead',
      action
    });
  }

  dripCampaignAction(action: string, campaignId: string, leadId?: string, context?: LogContext) {
    this.info(`Drip Campaign ${action}`, {
      ...context,
      campaignId,
      leadId,
      service: 'drip-campaign',
      action
    });
  }

  // External service logging
  externalService(service: string, action: string, success: boolean, context?: LogContext) {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    this.log(level, `External Service: ${service} ${action} ${success ? 'succeeded' : 'failed'}`, {
      ...context,
      service: 'external',
      action,
      externalService: service
    });
  }

  // User action logging
  userAction(userId: string, action: string, context?: LogContext) {
    this.info(`User Action: ${action}`, {
      ...context,
      userId,
      service: 'user',
      action
    });
  }

  // Security logging
  security(event: string, severity: 'low' | 'medium' | 'high' | 'critical', context?: LogContext) {
    const level = severity === 'critical' ? LogLevel.FATAL : 
                 severity === 'high' ? LogLevel.ERROR :
                 severity === 'medium' ? LogLevel.WARN : LogLevel.INFO;
    
    this.log(level, `Security Event: ${event}`, {
      ...context,
      service: 'security',
      severity
    });
  }
}

// Global logger instance
export const logger = new Logger(LogLevel.INFO);

// Request-scoped logger factory
export function createRequestLogger(requestId: string): Logger {
  const requestLogger = new Logger(LogLevel.INFO);
  requestLogger.setRequestId(requestId);
  return requestLogger;
}

// Logging middleware for error handling
export function withLogging<T extends any[], R>(
  fn: (...args: T) => R | Promise<R>,
  functionName: string,
  context?: LogContext
) {
  return async (...args: T): Promise<R> => {
    const timer = logger.time(functionName, context);
    
    try {
      logger.debug(`Executing ${functionName}`, context);
      const result = await fn(...args);
      timer();
      logger.debug(`Completed ${functionName}`, context);
      return result;
    } catch (error) {
      timer();
      if (error instanceof Error) {
        logger.error(`Error in ${functionName}`, error, context);
      } else {
        logger.error(`Unknown error in ${functionName}`, new Error(String(error)), context);
      }
      throw error;
    }
  };
}

// Performance monitoring
export class PerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map();

  static track(metricName: string, value: number) {
    if (!this.metrics.has(metricName)) {
      this.metrics.set(metricName, []);
    }
    this.metrics.get(metricName)!.push(value);
    
    // Log if value is above threshold
    if (value > 1000) { // 1 second threshold
      logger.warn(`Performance: ${metricName} took ${value}ms`, {
        service: 'performance',
        metric: metricName,
        value
      });
    }
  }

  static getMetrics(): Record<string, { avg: number; max: number; min: number; count: number }> {
    const result: Record<string, any> = {};
    
    for (const [name, values] of this.metrics.entries()) {
      if (values.length > 0) {
        result[name] = {
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          max: Math.max(...values),
          min: Math.min(...values),
          count: values.length
        };
      }
    }
    
    return result;
  }

  static reset() {
    this.metrics.clear();
  }
}

// Usage examples in comments for documentation:
/*
// Basic logging
logger.info('User logged in', { userId: '123' });
logger.error('Database connection failed', error, { service: 'database' });

// API logging
logger.apiRequest('POST', '/api/campaigns', { userId: '123' });
logger.apiResponse('POST', '/api/campaigns', 201, 234, { userId: '123' });

// Performance tracking
const timer = logger.time('expensive-operation');
// ... do work
timer();

// Business logic logging
logger.campaignAction('created', 'camp-123', { userId: '456' });
logger.leadAction('converted', 'lead-789', { campaignId: 'camp-123' });

// Security events
logger.security('failed-login-attempt', 'medium', { userId: '123', ip: '192.168.1.1' });

// Wrapped function with automatic logging
const safeFunction = withLogging(
  async (param: string) => {
    // function logic
    return result;
  },
  'functionName',
  { service: 'business-logic' }
);
*/