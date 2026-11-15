import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
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
          borderRadius: "36px",
          color: "white",
          fontSize: "96px",
          fontWeight: 800,
          fontFamily: "system-ui, sans-serif",
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
