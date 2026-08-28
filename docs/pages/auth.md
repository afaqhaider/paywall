# Auth Pages

These are the public-facing, unauthenticated entry points into the SSCodeAxis web app (`apps/web`, Next.js App Router) - the landing page and the standalone login/registration/password-reset flows - except where noted (the invitation-accept page requires a signed-in session).

## /

**Purpose:** Marketing/landing page showing the platform name and live API/database health status. Entry point for both anonymous visitors and returning users.

**Access requirements:** Public, no auth required. Reads auth `status` from `useAuth()` only to decide which CTA buttons to show; does not redirect or gate content.

**API calls:** `GET {NEXT_PUBLIC_API_URL}/health` (raw `fetch`, not `apiFetch`) - called on mount and then polled every 10 seconds via `setInterval` until unmount.

**Key UI/behavior:** Shows three status cards (API Status, Database Status, Version) driven by the health response's `database` field and `version`/`environment`. If `status === "authenticated"` (from `AuthProvider`'s silent refresh on load), shows a "Go to dashboard" button linking to `/dashboard`; otherwise shows "Log in" (`/login`) and "Get started" (`/register`) buttons.

**Edge cases / notes:** The health fetch failing just flips the badges to "Offline"/"Disconnected" - there's no visible error banner. `environment` falls back to `process.env.NODE_ENV` and `version` falls back to `"-"` if the health call hasn't succeeded yet.

## /login

**Purpose:** Standard email/password sign-in page, including a second-step two-factor authentication (2FA) challenge for accounts that have it enabled.

**Access requirements:** Public. No redirect guard is present in this file for already-authenticated users (unlike the landing page, it doesn't check `status`).

**API calls:**

- `POST /auth/login` with `{ email, password, rememberMe }` - on form submit.
- `POST /auth/2fa/verify-login` with `{ challengeToken, code }` - on submitting the 2FA code form (only reached if step 1 returns a challenge).
- Indirectly, `POST /auth/refresh` (via `AuthProvider`'s mount effect) and Google OAuth via `GoogleSignInButton` (not read in detail here, but rendered as an alternate sign-in option).

**Key UI/behavior:** Email + password fields (both `required`, native HTML validation only, no client-side regex/minLength enforced on login), a "Remember me" checkbox passed through to the login call, and a "Forgot password?" link to `/forgot-password`. On success (`login()` resolving with `twoFactorRequired: false`) it stores the session and routes to `/dashboard`. If the backend responds with `twoFactorRequired: true`, the form swaps to a 6-digit code entry view (numeric input, `autoComplete="one-time-code"`, auto-strips non-digits, submit disabled unless exactly 6 digits) with a "Back to login" link that resets the challenge state. A Google sign-in button and a link to `/register` are also present.

**Edge cases / notes:** The 2FA challenge token is purely client-side state (`useState`) tied to this page - if the code is wrong or expires, the error is shown but the challenge token stays until the user clicks "Back to login." `login()` never establishes a session for a 2FA account until `verifyTwoFactorLogin` succeeds - per a comment in `auth-context.tsx`, no cookie/session exists during the challenge step. Errors from the API are surfaced via `ApiError.message`; anything else falls back to a generic string.

## /register

**Purpose:** New account creation (self-service sign-up).

**Access requirements:** Public. No redirect guard for already-authenticated users.

**API calls:** `POST /auth/register` with `{ email, password, firstName, lastName }` (first/last name sent as `undefined` if left blank) - on submit.

**Key UI/behavior:** First/last name (optional), email (`required`, native `type="email"`), password (`required`, `minLength={12}`, with helper text stating the requirement for uppercase, lowercase, number, and symbol - this composition rule is not enforced client-side beyond the length, so it relies on the API to reject non-conforming passwords). On success, the form is replaced by an "Account created" confirmation with a link to `/login` - there is no auto-login or redirect. A Google sign-up button and a "Log in" link are also shown.

**Edge cases / notes:** Because `register()` doesn't log the user in automatically (it just calls the API and doesn't touch the token/session state), the user must go to `/login` manually afterward. No email-verification-required messaging appears here (the repo shows evidence of an email-verification flow being removed - `apps/web/src/app/verify-email/page.tsx` and `apps/api/.../verify-email.dto.ts` are deleted per git status - so registration success is presented as final).

## /forgot-password

**Purpose:** Initiates a password-reset email for a user who can't log in.

**Access requirements:** Public.

**API calls:** `POST /auth/forgot-password` with `{ email }` - on submit, via `apiFetch` (not `authedFetch`, since no session exists yet).

**Key UI/behavior:** Single email field (`required`, `type="email"`). Regardless of whether the API call succeeds or throws, the `finally` block always sets `done = true` and shows "If an account exists for that email, a reset link has been sent." plus a "Back to login" link.

**Edge cases / notes:** The success message is deliberately shown even on API failure (the `try`'s errors aren't caught/surfaced at all - only `finally` runs). This reads as an intentional email-enumeration mitigation: the UI never reveals whether the address exists or whether the request technically failed.

## /reset-password

**Purpose:** Completes a password reset using the token from the emailed reset link.

**Access requirements:** Public. Reads the reset token from the `?token=` query parameter.

**API calls:** `POST /auth/reset-password` with `{ token, newPassword }` - on submit, via `apiFetch`.

**Key UI/behavior:** Single new-password field (`required`, `minLength={12}`, no composition-rule enforcement shown beyond length). If no `token` query param is present, the form is replaced with a destructive alert ("Missing reset token…") and no form is rendered. On success, shows a success alert and redirects to `/login` after a 2-second `setTimeout`. The page wraps its form in a `Suspense` boundary (required because `useSearchParams` needs it in the App Router) with a `null` fallback.

**Edge cases / notes:** No token-expiry or invalid-token distinction is made client-side - any 4xx from the API is shown via the same generic `ApiError.message` / fallback text ("Could not reset password.").

## /invitations/accept

**Purpose:** Lets an existing (or newly created/logged-in) user accept a team invitation to join an application's member list, identified by a `?token=` query parameter.

**Access requirements:** Requires authentication - wrapped in `ProtectedRoute`, meaning an unauthenticated visitor is redirected/blocked before seeing this content (redirect logic itself lives in the `ProtectedRoute` component, not shown here). This is the one page in this set that is not a pure public/anonymous entry point.

**API calls:** `POST /invitations/{token}/accept` (token URL-encoded) - triggered by clicking "Accept invitation," via `authedFetch` (so it carries the bearer token and benefits from `AuthProvider`'s automatic 401-triggered refresh-and-retry).

**Key UI/behavior:** If no `token` query param is present, shows a destructive alert telling the user to ask the inviter to resend the link. Otherwise shows a card describing the invite (referencing `user?.email` as the account that will join) and an "Accept invitation" button. On success, shows the accepted role and email, then redirects after 2 seconds to `/dashboard/apps/{applicationId}/members` if the response includes an `applicationId`, otherwise to `/dashboard/apps`. Uses a `Suspense` boundary around the `useSearchParams`-dependent content, with a "Loading…" fallback.

**Edge cases / notes:** Because the page is auth-gated, a signed-out user clicking an invite link is presumably routed through login/register first by `ProtectedRoute` (not verified in this pass) before landing back here - the invitation itself is accepted as whichever account is currently logged in, which could mismatch the invited email address; the UI doesn't check or warn about that mismatch, it just displays `user?.email` as the account joining.

---

**Shared auth plumbing referenced above** (`apps/web/src/lib/auth-context.tsx`, `apps/web/src/lib/api-client.ts`):

- Access tokens are held only in an in-memory module variable (`inMemoryAccessToken`), not localStorage/sessionStorage - lost on full page reload, which is why `AuthProvider` calls `POST /auth/refresh` on mount to re-establish `status`/`user` from the refresh cookie.
- `apiFetch` always sends `credentials: "include"`, so refresh/session cookies (e.g., `csrf_token`) travel with every request; when `withCsrf: true` is passed, it also reads the `csrf_token` cookie and attaches it as an `x-csrf-token` header (used for `/auth/refresh` and `/auth/logout`).
- `authedFetch` wraps `apiFetch` and, on a 401 while an access token is present, transparently calls `refreshSession()` once and retries the original request before giving up.
