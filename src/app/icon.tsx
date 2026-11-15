import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0E6156",
          borderRadius: "8px",
          color: "white",
          fontSize: "18px",
          fontWeight: 800,
          fontFamily: "system-ui, sans-serif",
          boxShadow: "inset 0 1px 2px rgba(255,255,255,0.2)",
        }}
      >
        C
      </div>
    ),
    {
      ...size,
    }
  );
}
