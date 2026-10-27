"use client";
import { useState } from "react";
import { createAuthClient } from "better-auth/react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, ShieldCheck, Sprout } from "lucide-react";
import { Button, Logo } from "@/components/ui";
export function SignIn({
  ready,
  localSetup,
}: {
  ready: boolean;
  localSetup: boolean;
}) {
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  async function signIn() {
    setLoading(true);
    const client = createAuthClient();
    try {
      await client.signIn.social(
        { provider: "google", callbackURL: "/" },
        {
          onError: () => {
            setError(
              "This workspace is private. Sign in with the configured owner account.",
            );
            setLoading(false);
          },
        },
      );
    } catch {
      setError("Unable to sign in. Check workspace configuration.");
      setLoading(false);
    }
  }
  return (
    <main className="sign-in-page" id="main-content">
      <div className="sign-in-brand">
        <Logo />
      </div>
      <div className="sign-in-layout">
        <section>
          <span className="sign-in-flower">
            <Sprout size={46} strokeWidth={1.2} />
          </span>
          <h1>
            All of your calendars.
            <br />A little more calm.
          </h1>
          <p>
            One private space for your work, your life,
            <br />
            and everything you’re making time for.
          </p>
          <div className="sign-in-proof">
            <span>
              <CalendarDays size={17} />
              Every account, together
            </span>
            <span>
              <ShieldCheck size={17} />
              Private by design
            </span>
          </div>
        </section>
        <section className="sign-in-card">
          <Logo small />
          <h2>Welcome to your space.</h2>
          <p>Sign in to bring your day into focus.</p>
          {ready ? (
            <Button variant="primary" onClick={signIn} disabled={loading}>
              <span className="google-mark small">G</span>
              {loading ? "Opening Google…" : "Continue with Google"}
              <ArrowUpRight size={16} />
            </Button>
          ) : (
            <div className="setup-list">
              <b>Your workspace needs a little setup.</b>
              <p>
                Configure PostgreSQL, your owner email, Google OAuth
                credentials, and a token encryption key using the project
                README.
              </p>
            </div>
          )}
          {error ? (
            <p role="alert" className="error-text">
              {error}
            </p>
          ) : null}
          {localSetup ? (
            <Link href="/" className="button">
              Open workspace setup <ArrowUpRight size={15} />
            </Link>
          ) : null}
          <small>
            Calora is an owner-only workspace.
            <br />
            Google Calendar connections are read-only.
          </small>
        </section>
      </div>
      <footer>
        A little more breathing room.{" "}
        <span>© {new Date().getFullYear()} Calora</span>
      </footer>
    </main>
  );
}
