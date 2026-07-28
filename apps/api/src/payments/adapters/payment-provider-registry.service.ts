import { Inject, Injectable } from "@nestjs/common";
import type { PaymentProviderType } from "@prisma/client";
import type { PaymentProviderAdapter } from "./payment-provider.adapter";

export const PAYMENT_PROVIDER_ADAPTERS = "PAYMENT_PROVIDER_ADAPTERS";

/**
 * Resolves a `PaymentProviderAdapter` by `PaymentProviderType`. Adapters are
 * supplied as a DI multi-provider array (see payments.module.ts) - adding a
 * new provider means adding one class to that array, nothing here changes.
 */
@Injectable()
export class PaymentProviderRegistryService {
  private readonly adaptersByType = new Map<PaymentProviderType, PaymentProviderAdapter>();

  constructor(@Inject(PAYMENT_PROVIDER_ADAPTERS) adapters: PaymentProviderAdapter[]) {
    for (const adapter of adapters) {
      this.adaptersByType.set(adapter.type, adapter);
    }
  }

  getAdapter(type: PaymentProviderType): PaymentProviderAdapter {
    const adapter = this.adaptersByType.get(type);
    if (!adapter) {
      throw new Error(`No payment provider adapter registered for type ${type}`);
    }
    return adapter;
  }
}
