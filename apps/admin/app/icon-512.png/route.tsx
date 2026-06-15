import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(<Icon size={512} />, {
    width: 512,
    height: 512,
  });
}

function Icon({ size }: { size: number }) {
  return (
    <div
      style={{
        alignItems: "center",
        background: "#0f172a",
        color: "#ffffff",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          border: "20px solid #38bdf8",
          borderRadius: size * 0.22,
          display: "flex",
          fontSize: 156,
          fontWeight: 800,
          height: size * 0.68,
          justifyContent: "center",
          letterSpacing: 0,
          width: size * 0.68,
        }}
      >
        LP
      </div>
    </div>
  );
}
