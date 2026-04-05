/**
 * queue.ts — LLM request queue.
 * Processes one at a time, tracks average response time,
 * exposes queue position and estimated wait to callers.
 */

interface QueueEntry {
  id: string;
  execute: () => Promise<string>;
  resolve: (value: { content: string; toolsUsed: string[] }) => void;
  reject: (reason: Error) => void;
  enqueuedAt: number;
}

class LLMQueue {
  private queue: QueueEntry[] = [];
  private processing = false;
  private avgResponseMs = 20000;
  private samples: number[] = [];
  private maxSamples = 8;

  get length() {
    return this.queue.length;
  }

  getEstimatedWait(position: number): number {
    return Math.round((position * this.avgResponseMs) / 1000);
  }

  enqueue(
    id: string,
    execute: () => Promise<{ content: string; toolsUsed: string[] }>
  ): Promise<{ content: string; toolsUsed: string[] }> {
    return new Promise((resolve, reject) => {
      this.queue.push({ id, execute, resolve, reject, enqueuedAt: Date.now() });
      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    const entry = this.queue.shift()!;
    const start = Date.now();
    try {
      const result = await entry.execute();
      const elapsed = Date.now() - start;
      this.samples.push(elapsed);
      if (this.samples.length > this.maxSamples) this.samples.shift();
      this.avgResponseMs = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
      entry.resolve(result);
    } catch (err) {
      entry.reject(err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.processing = false;
      this.process();
    }
  }
}

export const llmQueue = new LLMQueue();
