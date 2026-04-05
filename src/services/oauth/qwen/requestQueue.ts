interface RequestQueueOptions {
  minIntervalMS?: number; // default 1000
  jitterMinMS?: number; // default 500
  jitterMaxMS?: number; // default 1500
}

export class RequestQueue {
  private lastRequestTime = 0;
  private readonly minIntervalMS: number;
  private readonly jitterMinMS: number;
  private readonly jitterMaxMS: number;

  constructor(options: RequestQueueOptions = {}) {
    this.minIntervalMS = options.minIntervalMS ?? 1000;
    this.jitterMinMS = options.jitterMinMS ?? 500;
    this.jitterMaxMS = options.jitterMaxMS ?? 1500;
  }

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (this.lastRequestTime > 0 && elapsed < this.minIntervalMS) {
      const jitter = this.jitterMinMS + Math.random() * (this.jitterMaxMS - this.jitterMinMS);
      const waitTime = this.minIntervalMS - elapsed + jitter;
      await new Promise((r) => setTimeout(r, waitTime));
    }

    try {
      return await fn();
    } finally {
      this.lastRequestTime = Date.now();
    }
  }
}
