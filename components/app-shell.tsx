"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "cn";
import { LogOut, Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/brand/brand-mark";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { activeNavItem, FOOTER_NAV_ITEMS, NAV_ITEMS } from "@/lib/nav";
import { initials } from "@/lib/format";
import { signOut, type Session } from "@/lib/services/auth";
import { getAttention, type AttentionItem } from "@/lib/services/attention";
import { NotificationsBell } from "@/components/notifications-bell";

/**
 * Application chrome: a persistent dark-green rail on large screens, the same
 * navigation in a slide-over drawer on phones, and a top bar carrying the
 * current module's title.
 */
export function AppShell({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const current = activeNavItem(pathname);
  const [waiting, setWaiting] = React.useState(0);
  const [attention, setAttention] = React.useState<AttentionItem[]>([]);

  // Re-read on every navigation, so the sidebar badge and the bell update as soon
  // as a request is confirmed or declined and staff come back to another page.
  React.useEffect(() => {
    let cancelled = false;
    void getAttention().then((next) => {
      if (cancelled) return;
      setWaiting(next.requestsWaiting);
      setAttention(next.items);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const handleSignOut = () => {
    signOut();
    router.replace("/login");
  };

  return (
    <div className="flex min-h-screen w-full">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <SidebarBody
          pathname={pathname}
          onSignOut={handleSignOut}
          requestsWaiting={waiting}
        />
      </aside>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-64 gap-0 border-none bg-sidebar p-0 text-sidebar-foreground sm:max-w-64"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody
            pathname={pathname}
            onSignOut={handleSignOut}
            onNavigate={() => setDrawerOpen(false)}
            requestsWaiting={waiting}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 bg-card px-4 shadow-[0_1px_0_#eef0ee,0_4px_16px_rgba(15,23,42,0.03)] sm:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Button>

          <h1 className="min-w-0 flex-1 truncate text-[22px] leading-none font-semibold tracking-tight">
            {current?.title ?? "ARG TECH"}
          </h1>

          <NotificationsBell items={attention} />

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Account menu"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {initials(session.fullName) || <User className="size-4" />}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {/* Menu labels must sit inside a group. */}
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <div className="text-sm font-medium text-foreground">{session.fullName}</div>
                  <div className="mt-0.5 text-xs font-normal text-muted-foreground">
                    {session.username} · {session.role}
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarBody({
  pathname,
  onSignOut,
  onNavigate,
  requestsWaiting,
}: {
  pathname: string;
  onSignOut: () => void;
  /** Requests waiting for a reply, shown as a badge on the Requests link. */
  requestsWaiting: number;
  /** Supplied by the mobile drawer so tapping a link closes it. */
  onNavigate?: () => void;
}) {
  const current = activeNavItem(pathname);

  return (
    <>
      <div className="flex h-20 shrink-0 items-center px-6">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          aria-label="ARG TECH, go to the dashboard"
          className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/60"
        >
          <BrandLockup tone="white" />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={current?.href === item.href}
            onNavigate={onNavigate}
            badge={item.href === "/requests" ? requestsWaiting : 0}
          />
        ))}
      </nav>

      <div className="mx-2 space-y-1 border-t border-white/10 py-3">
        {FOOTER_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={current?.href === item.href}
            onNavigate={onNavigate}
          />
        ))}
        <button
          type="button"
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/90 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
        >
          <LogOut className="size-5 shrink-0" />
          Log Out
        </button>
      </div>
    </>
  );
}

function NavLink({
  item,
  active,
  onNavigate,
  badge = 0,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
  onNavigate?: () => void;
  /** Small count shown at the right of the label; hidden when zero. */
  badge?: number;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none",
        active
          ? "bg-white/[0.12] text-white"
          : "text-sidebar-foreground/90 hover:bg-white/[0.07] hover:text-white",
      )}
    >
      <Icon className="size-5 shrink-0" />
      <span className="truncate">{item.label}</span>
      {badge > 0 ? (
        <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-white px-1.5 py-0.5 text-xs leading-none font-semibold text-sidebar tabular-nums">
          {badge}
          <span className="sr-only"> waiting</span>
        </span>
      ) : null}
    </Link>
  );
}
