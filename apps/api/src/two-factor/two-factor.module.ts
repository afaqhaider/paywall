import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../auth/auth.module";
import { TwoFactorController } from "./two-factor.controller";
import { TwoFactorLoginController } from "./two-factor-login.controller";
import { TwoFactorService } from "./two-factor.service";

@Module({
  imports: [
    AuthModule,
    // A second JwtModule registration bound to the same JWT_ACCESS_SECRET as
    // `AuthModule` - needed here only to *verify* the short-lived 2FA
    // challenge token AuthService.login() signs; AuthModule doesn't export
    // its JwtModule, so this configures an equivalent instance rather than
    // touching auth.module.ts.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
      }),
    }),
  ],
  controllers: [TwoFactorController, TwoFactorLoginController],
  providers: [TwoFactorService],
  exports: [TwoFactorService],
})
export class TwoFactorModule {}
