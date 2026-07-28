import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ProviderCredentialsService } from "./provider-credentials.service";
import { PaymentProviderRegistryService } from "./adapters/payment-provider-registry.service";
import type {
  PaymentProviderAdapter,
  ResolvedAccount,
  ResolvedCredentials,
} from "./adapters/payment-provider.adapter";

export interface ResolvedProvider {
  providerId: string;
  organizationId: string;
  adapter: PaymentProviderAdapter;
  credentials: ResolvedCredentials;
  account: ResolvedAccount | null;
}

/** Loads a `PaymentProvider` row and assembles everything an adapter call needs: the adapter instance, decrypted credentials, and the connected account. */
@Injectable()
export class ProviderResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialsService: ProviderCredentialsService,
    private readonly registry: PaymentProviderRegistryService,
  ) {}

  async resolve(providerId: string): Promise<ResolvedProvider> {
    const provider = await this.prisma.paymentProvider.findUniqueOrThrow({
      where: { id: providerId },
    });
    const adapter = this.registry.getAdapter(provider.type);
    const [credentials, account] = await Promise.all([
      this.credentialsService.resolveForAdapter(providerId),
      this.credentialsService.resolveAccount(providerId),
    ]);

    return { providerId, organizationId: provider.organizationId, adapter, credentials, account };
  }
}
