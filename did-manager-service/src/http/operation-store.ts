import { randomUUID } from 'node:crypto';

import { classifyManagerHttpError } from '../errors.js';
import type { ManagerOperationStatus, ManagerOperationType } from '../types.js';

const nowIso = (): string => new Date().toISOString();

export class OperationStore {
  private readonly operations = new Map<string, ManagerOperationStatus>();
  private currentOperationId: string | null = null;

  current(): ManagerOperationStatus | null {
    return this.currentOperationId === null ? null : (this.operations.get(this.currentOperationId) ?? null);
  }

  list(): ManagerOperationStatus[] {
    return Array.from(this.operations.values()).sort((left, right) => {
      const leftTime = left.completedAt ?? left.submittedAt;
      const rightTime = right.completedAt ?? right.submittedAt;
      return rightTime.localeCompare(leftTime);
    });
  }

  get(id: string): ManagerOperationStatus | undefined {
    return this.operations.get(id);
  }

  start<T>(type: ManagerOperationType, task: () => Promise<T>): ManagerOperationStatus {
    const running = this.current();
    if (running !== null && running.status === 'running') {
      throw new Error(`Another operation is already running: ${running.type}`);
    }

    const operation: ManagerOperationStatus = {
      id: randomUUID(),
      type,
      status: 'running',
      submittedAt: nowIso(),
      completedAt: null,
      result: null,
      error: null,
    };
    this.operations.set(operation.id, operation);
    this.currentOperationId = operation.id;

    void (async () => {
      try {
        operation.result = await task();
        operation.status = 'succeeded';
        operation.completedAt = nowIso();
      } catch (error) {
        const failure = classifyManagerHttpError(error);
        operation.status = 'failed';
        operation.completedAt = nowIso();
        operation.error = {
          message: failure.message,
          errorCode: failure.errorCode,
          statusCode: failure.statusCode,
        };
      } finally {
        if (this.currentOperationId === operation.id) {
          this.currentOperationId = null;
        }
        this.trimCompleted();
      }
    })();

    return operation;
  }

  private trimCompleted(): void {
    const completed = Array.from(this.operations.values())
      .filter((operation) => operation.status !== 'running')
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    for (const operation of completed.slice(50)) {
      this.operations.delete(operation.id);
    }
  }
}
