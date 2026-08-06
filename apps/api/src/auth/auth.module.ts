import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { secrets } from "../config/secrets";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { GoogleStrategy, GoogleConfiguredGuard } from "./strategies/google.strategy";
import { ACCESS_TOKEN_TTL } from "./auth.constants";

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: secrets.jwtAccessSecret,
      signOptions: { expiresIn: ACCESS_TOKEN_TTL },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy, GoogleConfiguredGuard],
  exports: [AuthService],
})
export class AuthModule {}
