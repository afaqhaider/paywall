"use client";

import { useState } from "react";
import { Button } from "@paywall/ui";

/**
 * Displays a plaintext secret (API key, license key) that the backend only
 * returns once, at creation/rotation time - same "copy it now, you won't see
 * it again" UX as a GitHub personal access token.
 */
export function CopyableSecret({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context) - the value is still selectable/visible.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 overflow-x-auto rounded-md bg-slate-900 px-3 py-2 text-xs text-slate-50">
        {value}
      </code>
      <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
        {copied ? "Copied!" : "Copy"}
      </Button>
    </div>
  );
}
