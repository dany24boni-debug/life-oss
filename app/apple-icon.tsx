import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 120,
          fontWeight: 700,
          letterSpacing: "-0.05em",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        L
      </div>
    ),
    size,
  );
}
