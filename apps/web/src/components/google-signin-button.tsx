import { API_URL } from "../lib/api-client";

/**
 * Plain top-level navigation to the API's OAuth redirect route - this is
 * NOT a fetch/authedFetch call. The browser must actually leave the page
 * so Google can show its consent screen and redirect back with a real
 * `code`; the API then sets the session cookies and redirects here.
 */
export function GoogleSignInButton({ label = "Continue with Google" }: { label?: string }) {
  return (
    <a
      href={`${API_URL}/auth/google`}
      className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.54-5.17 3.54-8.65z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.15-4.05 1.15-3.11 0-5.75-2.1-6.69-4.93H1.3v3.1A12 12 0 0 0 12 24z"
        />
        <path
          fill="#FBBC05"
          d="M5.31 14.31A7.2 7.2 0 0 1 4.93 12c0-.8.14-1.58.38-2.31v-3.1H1.3A12 12 0 0 0 0 12c0 1.94.46 3.77 1.3 5.41l4.01-3.1z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.3 6.59l4.01 3.1C6.25 6.86 8.89 4.75 12 4.75z"
        />
      </svg>
      {label}
    </a>
  );
}
