import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  withTimeout,
  type HealthCheckResult,
  type HealthProvider,
} from "../health-provider.interface";

/**
 * This platform has no object-storage integration yet (invoice/receipt PDFs
 * are generated on demand in memory, never persisted to disk - see
 * `customer-portal/financial-documents/financial-pdf.util.ts`). Until a real
 * storage backend is wired up, this checks the one storage dependency that
 * genuinely exists: the local filesystem the process runs on being writable.
 */
@Injectable()
export class StorageHealthProvider implements HealthProvider {
  readonly name = "storage";

  async check(): Promise<HealthCheckResult> {
    return withTimeout(this.name, async () => {
      let dir: string | undefined;
      try {
        dir = await mkdtemp(join(tmpdir(), "paywall-health-"));
        await writeFile(join(dir, randomUUID()), "ok");
        return { name: this.name, status: "HEALTHY", checkedAt: new Date().toISOString() };
      } catch (error) {
        return {
          name: this.name,
          status: "DOWN",
          message: error instanceof Error ? error.message : "Local filesystem is not writable",
          checkedAt: new Date().toISOString(),
        };
      } finally {
        if (dir) {
          await rm(dir, { recursive: true, force: true }).catch(() => undefined);
        }
      }
    });
  }
}
