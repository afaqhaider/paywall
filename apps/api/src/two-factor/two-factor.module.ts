import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { secrets } from "../config/secrets";
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
    JwtModule.register({
      secret: secrets.jwtAccessSecret,
    }),
  ],
  controllers: [TwoFactorController, TwoFactorLoginController],
  providers: [TwoFactorService],
  exports: [TwoFactorService],
})
export class TwoFactorModule {}
