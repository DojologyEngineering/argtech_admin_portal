"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark, BrandWordmark } from "@/components/brand/brand-mark";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSession, signIn } from "@/lib/services/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = React.useState("admin");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Someone already signed in should not sit on the login screen.
  React.useEffect(() => {
    if (getSession()) router.replace("/dashboard");
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(username, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-primary lg:flex-row">
      {/* ------------------------------------------------ branding panel */}
      <div className="relative flex shrink-0 items-center justify-center overflow-hidden px-6 py-12 lg:w-[45%] lg:py-0">
        <Decor />
        <div className="relative z-10 flex flex-col items-center gap-6">
          <BrandMark tone="white" className="h-20 sm:h-24 lg:h-32" />
          <BrandWordmark tone="white" className="h-4 sm:h-5 lg:h-7" />
        </div>
      </div>

      {/* ---------------------------------------------------- form panel */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-t-[2.5rem] bg-card px-6 py-12 lg:rounded-l-[3rem] lg:rounded-tr-none lg:px-16">
        <LeafDecor />
        <div className="relative z-10 w-full max-w-md">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the username and password to get access
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="username">User name</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="h-12"
                aria-invalid={Boolean(error) || undefined}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 pr-11"
                  aria-invalid={Boolean(error) || undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? (
                    <Eye className="size-4" />
                  ) : (
                    <EyeOff className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
              >
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={submitting}
              className="h-12 w-full text-sm font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Login"
              )}
            </Button>
          </form>

          <details className="group mt-6 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer rounded-lg font-medium text-foreground outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50">
              Demo accounts
            </summary>
            <p className="mt-2">
              Sign in with <code className="font-mono">admin</code>,{" "}
              <code className="font-mono">sophal</code> or{" "}
              <code className="font-mono">dara</code> and any password.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}

/** Soft circles on the green panel, echoing the brand mockup. */
function Decor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <span className="absolute -top-16 -left-20 size-56 rounded-full bg-white/15" />
      <span className="absolute top-1/4 left-1/2 size-40 rounded-full bg-white/12" />
      <span className="absolute -bottom-24 -left-10 size-64 rounded-full bg-white/15" />
      <span className="absolute right-8 bottom-16 size-32 rounded-full bg-white/12" />
    </div>
  );
}

/** Leaf-like blobs bleeding in from the corners of the form panel. */
function LeafDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="absolute -top-24 -right-16 h-56 w-80 rotate-[-18deg] rounded-[100%] bg-primary/90" />
      <span className="absolute -right-24 -bottom-28 h-64 w-96 rotate-[12deg] rounded-[100%] bg-primary/85" />
      <span className="absolute -bottom-16 left-1/3 h-32 w-72 rotate-[6deg] rounded-[100%] bg-primary/70" />
    </div>
  );
}
