import {
  Injectable,
  NotImplementedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, type Profile } from "passport-github2";

type VerifyCallback = (error: Error | null, user?: GithubProfile) => void;

export interface GithubProfile {
  githubId: string;
  email: string;
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

/**
 * Registered unconditionally, same reasoning as `GoogleStrategy`: the app
 * boots the same way whether or not GITHUB_CLIENT_ID/SECRET are set.
 * `AuthController` checks `configured` before invoking this strategy, so an
 * unconfigured deployment gets a clean 501 instead of a broken redirect.
 */
@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, "github") {
  readonly configured: boolean;

  constructor(configService: ConfigService) {
    const clientID = configService.get<string>("GITHUB_CLIENT_ID");
    const clientSecret = configService.get<string>("GITHUB_CLIENT_SECRET");
    const callbackURL = configService.get<string>(
      "GITHUB_CALLBACK_URL",
      "http://localhost:4000/auth/github/callback",
    );

    super({
      clientID: clientID || "not-configured",
      clientSecret: clientSecret || "not-configured",
      callbackURL,
      scope: ["user:email"],
    });

    this.configured = Boolean(clientID && clientSecret);
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    // GitHub only returns emails when the `user:email` scope is granted, and
    // even then a user may have every email set private - unlike Google,
    // there is no guarantee of a usable address here.
    const primaryEmail = profile.emails?.find((e) => (e as { primary?: boolean }).primary)?.value;
    const email = primaryEmail ?? profile.emails?.[0]?.value;
    if (!email) {
      done(
        new Error(
          "GitHub account has no public/verified email - add one to your GitHub account or make your primary email public",
        ),
        undefined,
      );
      return;
    }

    const [firstName, ...rest] = (profile.displayName ?? profile.username ?? "").split(" ");

    const githubProfile: GithubProfile = {
      githubId: profile.id,
      email,
      // GitHub only exposes emails obtained via `user:email` that are
      // already verified on GitHub's side - if it's here, treat it as
      // verified, same trust model as Google's `emails[0].verified`.
      emailVerified: true,
      firstName: firstName || undefined,
      lastName: rest.length ? rest.join(" ") : undefined,
      avatarUrl: profile.photos?.[0]?.value,
    };

    done(null, githubProfile);
  }
}

/**
 * Runs before `AuthGuard("github")` on both GitHub routes so an
 * unconfigured server returns a clean 501 instead of redirecting the
 * browser to GitHub with an invalid client_id.
 */
@Injectable()
export class GithubConfiguredGuard implements CanActivate {
  constructor(private readonly githubStrategy: GithubStrategy) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!this.githubStrategy.configured) {
      throw new NotImplementedException("GitHub sign-in is not configured on this server");
    }
    return true;
  }
}
