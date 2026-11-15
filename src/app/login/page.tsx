import React from "react";
import { LoginClient } from "@/components/LoginClient";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const demoModeEnabled =
    process.env.APP_DEMO_MODE === "true" ||
    (process.env.NODE_ENV !== "production" && process.env.APP_DEMO_MODE !== "false");

  return <LoginClient demoModeEnabled={demoModeEnabled} />;
}
