"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  clientTrue,
  getServerSessionSnapshot,
  getSessionSnapshot,
  serverFalse,
  subscribeNever,
  subscribeSession,
} from "@/lib/services/auth";

/**
 * Client-side gate for every signed-in screen.
 *
 * Phase 1 has no auth backend, so the session lives in session storage and is
 * read as an external store — that keeps server and client render in agreement
 * without copying it into state. When a real backend lands this becomes a
 * server-side session lookup and the screens underneath do not change.
 */
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const hydrated = React.useSyncExternalStore(
    subscribeNever,
    clientTrue,
    serverFalse,
  );
  const session = React.useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );

  React.useEffect(() => {
    if (hydrated && !session) router.replace("/login");
  }, [hydrated, session, router]);

  if (!hydrated || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading portal…
      </div>
    );
  }

  return <AppShell session={session}>{children}</AppShell>;
}
