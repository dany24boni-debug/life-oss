import { CallbackHashHandler } from "./_client";
import { safeNext } from "@/lib/auth/safe-next";

// Implicit-flow magic-link landing page. The PKCE callback
// (app/auth/callback/route.ts) redirects here when there's no ?code=,
// because the session tokens live in the URL hash fragment — readable
// only in the browser. A Route Handler can't render React to read the
// hash, so this stays a page with a client component.
//
// `next` is re-sanitised here (not trusted from the callback) because
// /auth/confirm is directly reachable via URL.
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(
    typeof params.next === "string" ? params.next : null,
  );

  return <CallbackHashHandler next={next} />;
}
