import { Injectable, Logger } from "@nestjs/common";
import type { BackgroundJob, Prisma } from "@prisma/client";

export type JobProcessor = (payload: Prisma.JsonValue, job: BackgroundJob) => Promise<void>;

/**
 * The "Subscribers" half of Event -> Queue -> Worker -> Subscribers: every
 * feature that wants to react to a job (an automation rule's action chain,
 * a scheduled task, a notification delivery, an ERP sync) registers one
 * processor here, keyed by the same `type` string it enqueues jobs under.
 * `JobWorkerService` resolves and invokes the processor - it never knows
 * about any specific feature.
 */
@Injectable()
export class JobProcessorRegistryService {
  private readonly logger = new Logger(JobProcessorRegistryService.name);
  private readonly processors = new Map<string, JobProcessor>();

  register(type: string, processor: JobProcessor): void {
    if (this.processors.has(type)) {
      throw new Error(`A job processor is already registered for type "${type}"`);
    }
    this.processors.set(type, processor);
    this.logger.log(`Registered job processor for type "${type}"`);
  }

  resolve(type: string): JobProcessor | undefined {
    return this.processors.get(type);
  }
}
