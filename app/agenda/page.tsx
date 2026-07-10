import { redirect } from "next/navigation";

/**
 * /agenda — la pagina legacy è stata ritirata (run-05 prompt 1): il
 * calendario nuovo vive a /calendar (eventi locali su Dexie + blocco
 * Google con Sincronizza/Disconnetti). La rotta resta come redirect
 * anche perché il callback OAuth di Google atterra ancora qui: dopo la
 * connessione si arriva a /calendar per transito, chiudendo il cerchio
 * lasciato aperto dal run-04 senza toccare la API route. I parametri
 * `connected`/`error` del callback (slug già allowlistati lato route;
 * qui ri-sanitizzati per difesa in profondità) vengono inoltrati così
 * /calendar può dare il feedback di connessione che dava la legacy.
 */

const SLUG_RE = /^[a-z0-9_]{1,40}$/;

export default async function AgendaPage(props: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await props.searchParams;
  if (typeof error === "string" && SLUG_RE.test(error)) {
    redirect(`/calendar?google_error=${error}`);
  }
  if (typeof connected === "string" && SLUG_RE.test(connected)) {
    redirect("/calendar?google_connected=1");
  }
  redirect("/calendar");
}
