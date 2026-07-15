/*
 * LifeOS service worker — fatto a mano, zero dipendenze (run-05 prompt 2,
 * stub 13). Niente manifest di precache in build: SOLO runtime caching, con
 * strategie per famiglia di risorsa:
 *
 *   - navigazioni  → network-first, fallback cache, ultima spiaggia /offline
 *   - /_next/static → cache-first (content-hashed: immutabili per natura)
 *   - font/icone/manifest → stale-while-revalidate
 *   - MAI toccati: /api/**, /sw.js, richieste non-GET, origini esterne
 *     (Supabase e Google vivono su altri domini: il browser li gestisce
 *     senza passare di qui per il caching — il fetch handler li ignora)
 *
 * Versioning: SW_VERSION entra nei nomi cache; `activate` cancella ogni
 * cache di versioni precedenti. L'aggiornamento è guidato dall'utente:
 * il client mostra un toast e manda SKIP_WAITING (vedi pwa-host.tsx).
 * Kill-switch documentato in public/sw-kill.js.txt.
 */

const SW_VERSION = "v2";
const CACHE_PAGES = `lifeos-pages-${SW_VERSION}`;
const CACHE_STATIC = `lifeos-static-${SW_VERSION}`;
const CACHE_ASSETS = `lifeos-assets-${SW_VERSION}`;
const KNOWN_CACHES = [CACHE_PAGES, CACHE_STATIC, CACHE_ASSETS];

const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  // La pagina di fallback si mette in cache SUBITO, a ogni install (anche
  // negli aggiornamenti: l'HTML fresco punta ai chunk freschi).
  event.waitUntil(
    caches
      .open(CACHE_PAGES)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" }))),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("lifeos-") && !KNOWN_CACHES.includes(n))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// ── Push (run-09 prompt 5, blueprint 17) ──────────────────────────────
// Il payload arriva dalla Edge Function push-sender: { title, body,
// tag, url }. Difensivo su ogni campo: un payload rotto mostra comunque
// una notifica onesta (il permesso è stato speso: qualcosa si mostra).

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title =
    typeof data.title === "string" && data.title !== "" ? data.title : "LifeOS";
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: "/icon-512",
    badge: "/icon",
    data: { url: typeof data.url === "string" ? data.url : "/" },
  };
  if (typeof data.tag === "string" && data.tag !== "") options.tag = data.tag;
  event.waitUntil(self.registration.showNotification(title, options));
});

// Tocco sulla notifica: focus di una finestra aperta (navigando all'url
// del payload) oppure apertura di una nuova.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client && url !== "/") {
            try {
              await client.navigate(url);
            } catch {
              // Navigazione negata (origine diversa dopo un redirect):
              // il focus da solo è già la cosa giusta.
            }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

/** true per gli asset immutabili di Next (nome file content-hashed). */
function isNextStatic(url) {
  return url.pathname.startsWith("/_next/static/");
}

/** Font, icone, manifest: cambiano di rado, vanno bene un giro indietro. */
function isSlowAsset(url) {
  return (
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/icon" ||
    url.pathname === "/icon-512" ||
    url.pathname === "/apple-icon" ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png")
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Origini esterne (Supabase, Google, ecc.): mai intercettate, mai cachate.
  if (url.origin !== self.location.origin) return;
  // API e lo stesso sw.js: sempre rete, mai cache.
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/sw.js") return;

  // ── Navigazioni: network-first ────────────────────────────────────────
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          // Si cacha solo una risposta piena e diretta: i redirect (es.
          // proxy → /login) e gli errori non diventano fallback offline.
          if (fresh.ok && !fresh.redirected) {
            const cache = await caches.open(CACHE_PAGES);
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch {
          const cached = await caches.match(request, {
            cacheName: CACHE_PAGES,
          });
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL, {
            cacheName: CACHE_PAGES,
          });
          if (offline) return offline;
          return new Response("Sei offline.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      })(),
    );
    return;
  }

  // ── Asset immutabili: cache-first ─────────────────────────────────────
  if (isNextStatic(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request, {
          cacheName: CACHE_STATIC,
        });
        if (cached) return cached;
        const fresh = await fetch(request);
        if (fresh.ok) {
          const cache = await caches.open(CACHE_STATIC);
          cache.put(request, fresh.clone());
        }
        return fresh;
      })(),
    );
    return;
  }

  // ── Font/icone/manifest: stale-while-revalidate ───────────────────────
  if (isSlowAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_ASSETS);
        const cached = await cache.match(request);
        const refresh = fetch(request)
          .then((fresh) => {
            if (fresh.ok) cache.put(request, fresh.clone());
            return fresh;
          })
          .catch(() => undefined);
        if (cached) {
          event.waitUntil(refresh);
          return cached;
        }
        const fresh = await refresh;
        if (fresh) return fresh;
        return new Response("", { status: 504 });
      })(),
    );
  }
  // Tutto il resto: comportamento di rete predefinito del browser.
});
