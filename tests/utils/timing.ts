// Performance timing utilities for integration tests

export class PerformanceTimer {
  private startTime?: number;
  private endTime?: number;
  private marks: Map<string, number> = new Map();

  start(): this {
    this.startTime = performance.now();
    return this;
  }

  mark(label: string): this {
    if (!this.startTime) {
      throw new Error('Timer not started. Call start() first.');
    }
    this.marks.set(label, performance.now());
    return this;
  }

  end(): this {
    this.endTime = performance.now();
    return this;
  }

  getDuration(): number {
    if (!this.startTime || !this.endTime) {
      throw new Error('Timer not completed. Call start() and end().');
    }
    return this.endTime - this.startTime;
  }

  getMarkDuration(label: string): number {
    if (!this.startTime) {
      throw new Error('Timer not started.');
    }
    
    const markTime = this.marks.get(label);
    if (!markTime) {
      throw new Error(`Mark '${label}' not found.`);
    }
    
    return markTime - this.startTime;
  }

  getAllMarks(): Record<string, number> {
    if (!this.startTime) {
      throw new Error('Timer not started.');
    }

    const result: Record<string, number> = {};
    for (const [label, time] of this.marks) {
      result[label] = time - this.startTime;
    }
    return result;
  }

  reset(): this {
    this.startTime = undefined;
    this.endTime = undefined;
    this.marks.clear();
    return this;
  }
}

export class WebhookTimer {
  private webhookReceived?: number;
  private dbWriteStarted?: number;
  private dbWriteCompleted?: number;
  private apiCallStarted?: number;
  private apiCallCompleted?: number;
  private responseReturned?: number;

  webhookReceive(): this {
    this.webhookReceived = performance.now();
    return this;
  }

  dbWriteStart(): this {
    this.dbWriteStarted = performance.now();
    return this;
  }

  dbWriteComplete(): this {
    this.dbWriteCompleted = performance.now();
    return this;
  }

  apiCallStart(): this {
    this.apiCallStarted = performance.now();
    return this;
  }

  apiCallComplete(): this {
    this.apiCallCompleted = performance.now();
    return this;
  }

  responseReturn(): this {
    this.responseReturned = performance.now();
    return this;
  }

  getMetrics() {
    if (!this.webhookReceived || !this.responseReturned) {
      throw new Error('Webhook timing incomplete');
    }

    const metrics = {
      totalProcessingTime: this.responseReturned - this.webhookReceived,
      dbWriteTime: this.dbWriteStarted && this.dbWriteCompleted 
        ? this.dbWriteCompleted - this.dbWriteStarted 
        : 0,
      apiCallTime: this.apiCallStarted && this.apiCallCompleted
        ? this.apiCallCompleted - this.apiCallStarted
        : 0,
      timeToDbWrite: this.dbWriteStarted 
        ? this.dbWriteStarted - this.webhookReceived
        : 0,
      timeToApiCall: this.apiCallStarted
        ? this.apiCallStarted - this.webhookReceived
        : 0,
    };

    return metrics;
  }
}

export class ConcurrentTimer {
  private operations: Map<string, { start: number; end?: number }> = new Map();

  startOperation(id: string): this {
    this.operations.set(id, { start: performance.now() });
    return this;
  }

  endOperation(id: string): this {
    const operation = this.operations.get(id);
    if (!operation) {
      throw new Error(`Operation '${id}' not found`);
    }
    
    operation.end = performance.now();
    return this;
  }

  getOperationDuration(id: string): number {
    const operation = this.operations.get(id);
    if (!operation || !operation.end) {
      throw new Error(`Operation '${id}' not completed`);
    }
    
    return operation.end - operation.start;
  }

  getAllDurations(): Record<string, number> {
    const result: Record<string, number> = {};
    
    for (const [id, operation] of this.operations) {
      if (operation.end) {
        result[id] = operation.end - operation.start;
      }
    }
    
    return result;
  }

  getStatistics(): {
    count: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    totalDuration: number;
  } {
    const durations = Object.values(this.getAllDurations());
    
    if (durations.length === 0) {
      return {
        count: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        totalDuration: 0,
      };
    }
    
    return {
      count: durations.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      totalDuration: durations.reduce((a, b) => a + b, 0),
    };
  }

  reset(): this {
    this.operations.clear();
    return this;
  }
}

// Utility function to measure async function execution time
export async function measureAsync<T>(
  fn: () => Promise<T>,
  label?: string
): Promise<{ result: T; duration: number; label?: string }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  
  return { result, duration, label };
}

// Utility to wait for a specific duration
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Rate limiter for API calls
export class RateLimiter {
  private lastCall = 0;
  private minInterval: number;

  constructor(callsPerSecond: number) {
    this.minInterval = 1000 / callsPerSecond;
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCall;
    
    if (timeSinceLastCall < this.minInterval) {
      await delay(this.minInterval - timeSinceLastCall);
    }
    
    this.lastCall = Date.now();
  }
}