import {
  Injectable,
  NotImplementedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, type Profile, type VerifyCallback } from "passport-google-oauth20";
import { secrets } from "../../config/secrets";

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

/**
 * Registered unconditionally so the app boots the same way in every
 * environment (CI, other devs' machines, Docker) whether or not Google
 * OAuth is configured. If GOOGLE_CLIENT_ID/SECRET are missing, `configured`
 * is false and placeholder values satisfy passport-google-oauth20's
 * constructor (which throws on empty strings) - AuthController checks
 * `configured` before ever invoking this strategy, so an unconfigured
 * deployment gets a clean 501 instead of a broken redirect to Google.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  readonly configured: boolean;

  constructor() {
    super({
      clientID: secrets.google.clientId || "not-configured",
      clientSecret: secrets.google.clientSecret || "not-configured",
      callbackURL: secrets.google.callbackUrl,
      scope: ["email", "profile"],
    });

    this.configured = secrets.google.configured;
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error("Google account has no email"), undefined);
      return;
    }

    const googleProfile: GoogleProfile = {
      googleId: profile.id,
      email,
      emailVerified: profile.emails?.[0]?.verified !== false,
      firstName: profile.name?.givenName,
      lastName: profile.name?.familyName,
      avatarUrl: profile.photos?.[0]?.value,
    };

    done(null, googleProfile);
  }
}

/**
 * Runs before `AuthGuard("google")` on both Google routes so an
 * unconfigured server returns a clean 501 instead of redirecting the
 * browser to Google with an invalid client_id.
 */
@Injectable()
export class GoogleConfiguredGuard implements CanActivate {
  constructor(private readonly googleStrategy: GoogleStrategy) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!this.googleStrategy.configured) {
      throw new NotImplementedException("Google sign-in is not configured on this server");
    }
    return true;
  }
}
