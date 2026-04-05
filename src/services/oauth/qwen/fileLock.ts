import { openSync, closeSync, unlinkSync, existsSync, readFileSync, writeFileSync } from "fs";

interface LockMetadata {
  pid: number;
  timestamp: number;
}

interface FileLockOptions {
  staleThreshold?: number;
  timeout?: number;
}

export class FileLock {
  private lockPath: string;
  private staleThreshold: number;
  private timeout: number;
  private acquired = false;

  constructor(lockPath: string, options: FileLockOptions = {}) {
    this.lockPath = lockPath;
    this.staleThreshold = options.staleThreshold ?? 10_000;
    this.timeout = options.timeout ?? 5_000;
  }

  async acquire(): Promise<void> {
    const startTime = Date.now();

    while (true) {
      try {
        const fd = openSync(this.lockPath, "wx");
        writeFileSync(this.lockPath, JSON.stringify({ pid: process.pid, timestamp: Date.now() }));
        closeSync(fd);
        this.acquired = true;
        return;
      } catch (err: any) {
        if (err.code === "EEXIST") {
          if (this.isStale()) {
            this.removeStaleLock();
            continue;
          }
        } else {
          throw err;
        }
      }

      if (Date.now() - startTime > this.timeout) {
        throw new Error(`FileLock: timeout acquiring lock at ${this.lockPath}`);
      }

      await new Promise((r) => setTimeout(r, 100));
    }
  }

  release(): void {
    if (!this.acquired) return;
    try {
      if (existsSync(this.lockPath)) {
        unlinkSync(this.lockPath);
      }
    } finally {
      this.acquired = false;
    }
  }

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private isStale(): boolean {
    if (!existsSync(this.lockPath)) return false;
    try {
      const metadata: LockMetadata = JSON.parse(readFileSync(this.lockPath, "utf-8"));
      return Date.now() - metadata.timestamp > this.staleThreshold;
    } catch {
      return true;
    }
  }

  private removeStaleLock(): void {
    try {
      unlinkSync(this.lockPath);
    } catch {
      // Ignore
    }
  }
}
