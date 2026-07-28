import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request, Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { TwoFactorService } from "./two-factor.service";
import { VerifyTwoFactorLoginDto } from "./dto/verify-two-factor-login.dto";
import { Public } from "../common/decorators/public.decorator";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import { setRefreshCookies } from "../common/utils/cookie.util";

interface TwoFactorChallengePayload {
  sub: string;
  purpose: string;
}

/**
 * Completes the 2FA-gated login started by `AuthService.login()` (which
 * returns `{ twoFactorRequired: true, challengeToken }` instead of a token
 * pair when the user has 2FA enabled). Lives in its own module/controller
 * per the phase spec - `auth.controller.ts` itself is not touched beyond the
 * one described branch in its `login` handler.
 */
@Controller("auth/2fa")
export class TwoFactorLoginController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post("verify-login")
  @HttpCode(HttpStatus.OK)
  async verifyLogin(
    @Body() dto: VerifyTwoFactorLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    let payload: TwoFactorChallengePayload;
    try {
      payload = await this.jwtService.verifyAsync<TwoFactorChallengePayload>(dto.challengeToken);
    } catch {
      throw new UnauthorizedException("Invalid or expired two-factor challenge");
    }

    if (payload.purpose !== "2fa_challenge") {
      throw new UnauthorizedException("Invalid two-factor challenge");
    }

    const valid = await this.twoFactorService.verifyLoginCode(payload.sub, dto.code);
    if (!valid) {
      throw new UnauthorizedException("Invalid verification code");
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    const pair = await this.authService.issueTokenPair(user, extractRequestMeta(req), {
      rememberMe: false,
    });

    // Same cookie-setting shape as `auth.controller.ts`'s `respondWithTokenPair`
    // (kept local since that helper isn't exported).
    setRefreshCookies(res, pair.refreshToken, {
      maxAgeMs: pair.refreshTokenExpiresAt.getTime() - Date.now(),
    });

    return {
      accessToken: pair.accessToken,
      accessTokenExpiresInMs: pair.accessTokenExpiresInMs,
      user: pair.user,
    };
  }
}
