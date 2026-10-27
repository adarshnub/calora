import Link from "next/link";
export default function NotFound() {
  return (
    <main className="error-page">
      <h1>A little off schedule.</h1>
      <p>This page isn’t in your calendar.</p>
      <Link href="/" className="button primary">
        Back to your schedule
      </Link>
    </main>
  );
}
