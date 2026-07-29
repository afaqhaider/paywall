import { Module } from "@nestjs/common";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { FinancialEventsModule } from "../financial-events/financial-events.module";
import { PlatformEventsModule } from "../platform-events/platform-events.module";
import { CommissionsModule } from "../commissions/commissions.module";
import {
  ProvidersController,
  ProviderAccountsController,
  ProviderCredentialsController,
} from "./providers.controller";
import { ProvidersService } from "./providers.service";
import { ProviderCredentialsService } from "./provider-credentials.service";
import { ProviderResolverService } from "./provider-resolver.service";
import { SystemActorService } from "./system-actor.service";
import { PaymentEventDispatcherService } from "./payment-event-dispatcher.service";
import {
  PaymentProviderRegistryService,
  PAYMENT_PROVIDER_ADAPTERS,
} from "./adapters/payment-provider-registry.service";
import { ManualAdapter } from "./adapters/manual.adapter";
import { BankTransferAdapter } from "./adapters/bank-transfer.adapter";
import { StripeAdapter } from "./adapters/stripe.adapter";
import { AppleAdapter } from "./adapters/apple.adapter";
import { GooglePlayAdapter } from "./adapters/google-play.adapter";
import { PayPalAdapter } from "./adapters/paypal.adapter";
import { EasypaisaAdapter } from "./adapters/easypaisa.adapter";
import { JazzCashAdapter } from "./adapters/jazzcash.adapter";
import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";
import { WebhookIngestController, WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";
import { TransactionsController } from "./transactions.controller";
import { TransactionsService } from "./transactions.service";
import { RefundsController } from "./refunds.controller";
import { RefundsService } from "./refunds.service";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { DisputesController } from "./disputes.controller";
import { DisputesService } from "./disputes.service";
import { PaymentMethodsController } from "./payment-methods.controller";
import { PaymentMethodsService } from "./payment-methods.service";

@Module({
  imports: [SubscriptionsModule, FinancialEventsModule, PlatformEventsModule, CommissionsModule],
  controllers: [
    ProvidersController,
    ProviderAccountsController,
    ProviderCredentialsController,
    CheckoutController,
    WebhookIngestController,
    WebhooksController,
    TransactionsController,
    RefundsController,
    InvoicesController,
    DisputesController,
    PaymentMethodsController,
  ],
  providers: [
    ProvidersService,
    ProviderCredentialsService,
    ProviderResolverService,
    SystemActorService,
    PaymentEventDispatcherService,
    PaymentProviderRegistryService,
    {
      provide: PAYMENT_PROVIDER_ADAPTERS,
      useFactory: (
        manual: ManualAdapter,
        bankTransfer: BankTransferAdapter,
        stripe: StripeAdapter,
        apple: AppleAdapter,
        googlePlay: GooglePlayAdapter,
        paypal: PayPalAdapter,
        easypaisa: EasypaisaAdapter,
        jazzcash: JazzCashAdapter,
      ) => [manual, bankTransfer, stripe, apple, googlePlay, paypal, easypaisa, jazzcash],
      inject: [
        ManualAdapter,
        BankTransferAdapter,
        StripeAdapter,
        AppleAdapter,
        GooglePlayAdapter,
        PayPalAdapter,
        EasypaisaAdapter,
        JazzCashAdapter,
      ],
    },
    ManualAdapter,
    BankTransferAdapter,
    StripeAdapter,
    AppleAdapter,
    GooglePlayAdapter,
    PayPalAdapter,
    EasypaisaAdapter,
    JazzCashAdapter,
    CheckoutService,
    WebhooksService,
    TransactionsService,
    RefundsService,
    InvoicesService,
    DisputesService,
    PaymentMethodsService,
  ],
})
export class PaymentsModule {}
