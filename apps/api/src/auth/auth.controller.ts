import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { GoogleConfiguredGuard, type GoogleProfile } from "./strategies/google.strategy";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CsrfGuard } from "../common/guards/csrf.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import {
  clearRefreshCookies,
  REFRESH_COOKIE_NAME,
  setRefreshCookies,
} from "../common/utils/cookie.util";
import type { AuthenticatedUser } from "./strategies/jwt.strategy";
import type { TokenPair } from "./auth.service";

function respondWithTokenPair(res: Response, pair: TokenPair) {
  setRefreshCookies(res, pair.refreshToken, {
    maxAgeMs: pair.refreshTokenExpiresAt.getTime() - Date.now(),
  });
  return {
    accessToken: pair.accessToken,
    accessTokenExpiresInMs: pair.accessTokenExpiresInMs,
    user: pair.user,
  };
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get("google")
  @UseGuards(GoogleConfiguredGuard, AuthGuard("google"))
  async googleAuth(): Promise<void> {
    // GoogleConfiguredGuard rejects cleanly if unconfigured; otherwise
    // AuthGuard("google") intercepts the request and redirects to Google
    // before this body ever runs.
  }

  @Public()
  @Get("google/callback")
  @UseGuards(GoogleConfiguredGuard, AuthGuard("google"))
  async googleCallback(
    @Req() req: Request & { user: GoogleProfile },
    @Res() res: Response,
  ): Promise<void> {
    const pair = await this.authService.loginWithGoogle(req.user, extractRequestMeta(req));
    setRefreshCookies(res, pair.refreshToken, {
      maxAgeMs: pair.refreshTokenExpiresAt.getTime() - Date.now(),
    });

    const webOrigin = this.configService.get<string>("WEB_ORIGIN", "http://localhost:3000");
    res.redirect(`${webOrigin}/dashboard`);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register")
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const user = await this.authService.register(dto, extractRequestMeta(req));
    return { user, message: "Registration successful. Check your email to verify your account." };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, extractRequestMeta(req));
    if ("twoFactorRequired" in result) {
      return result;
    }
    return respondWithTokenPair(res, result);
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    const pair = await this.authService.refresh(refreshToken, extractRequestMeta(req));
    return respondWithTokenPair(res, pair);
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    await this.authService.logout(refreshToken, extractRequestMeta(req));
    clearRefreshCookies(res);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    await this.authService.verifyEmail(dto.token, extractRequestMeta(req));
    return { message: "Email verified successfully." };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("resend-verification")
  @HttpCode(HttpStatus.OK)
  async resendVerification(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    await this.authService.resendVerification(user.id, extractRequestMeta(req));
    return { message: "Verification email sent." };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    await this.authService.forgotPassword(dto.email, extractRequestMeta(req));
    return { message: "If an account exists for that email, a reset link has been sent." };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    await this.authService.resetPassword(dto.token, dto.newPassword, extractRequestMeta(req));
    return { message: "Password reset successfully. Please log in again." };
  }

  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    await this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
      extractRequestMeta(req),
    );
    return { message: "Password changed successfully. Please log in again." };
  }

  @Get("sessions")
  async listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.listSessions(user.id);
  }

  @Delete("sessions/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") sessionId: string,
    @Req() req: Request,
  ) {
    await this.authService.revokeSession(user.id, sessionId, extractRequestMeta(req));
  }
}
