export type ContextPriority = 'critical' | 'interactive' | 'background';

export interface ContextDescriptor {
  id: string;
  priority: ContextPriority;
  memoryMB: number;
}

export interface SchedulerSnapshot {
  active: ContextDescriptor[];
  totalMemory: number;
  rejected: ContextDescriptor[];
}

const PRIORITY_ORDER: ContextPriority[] = ['critical', 'interactive', 'background'];
const MAX_CONTEXTS = 20;
const MAX_MEMORY_MB = 4096;

export class ContextScheduler {
  private readonly contexts: ContextDescriptor[] = [];
  private readonly rejected: ContextDescriptor[] = [];

  registerContext(descriptor: ContextDescriptor) {
    this.contexts.push(descriptor);
    this.contexts.sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority));
    this.enforceBudgets();
  }

  getSnapshot(): SchedulerSnapshot {
    return {
      active: this.contexts.slice(),
      totalMemory: this.contexts.reduce((sum, context) => sum + context.memoryMB, 0),
      rejected: this.rejected.slice()
    };
  }

  private enforceBudgets() {
    while (this.contexts.length > MAX_CONTEXTS || this.totalMemory() > MAX_MEMORY_MB) {
      const removed = this.contexts.pop();
      if (!removed) break;
      this.rejected.push(removed);
    }
  }

  private totalMemory(): number {
    return this.contexts.reduce((sum, context) => sum + context.memoryMB, 0);
  }
}
