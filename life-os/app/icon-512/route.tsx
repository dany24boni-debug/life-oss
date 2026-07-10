import { ImageResponse } from "next/og";

/**
 * /icon-512 — icona raster 512×512 per il manifest (run-05 prompt 2),
 * generata con lo stesso pattern ImageResponse di app/icon.tsx (192) e
 * app/apple-icon.tsx (180), stessa lingua visiva. Con ?maskable=1 la "L"
 * si stringe nella zona sicura (l'80% centrale) per il purpose maskable
 * di Android; senza, riempie come le sorelle. Handler dinamico (legge la
 * query): ImageResponse imposta da sé Cache-Control immutable in prod.
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const maskable = searchParams.get("maskable") === "1";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fafafa",
          fontSize: maskable ? 260 : 346,
          fontWeight: 700,
          letterSpacing: "-0.05em",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        L
      </div>
    ),
    { width: 512, height: 512 },
  );
}
