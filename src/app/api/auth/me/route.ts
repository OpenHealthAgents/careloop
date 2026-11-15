import { NextResponse } from "next/server";
import { getPermissionsForRole } from "@/lib/auth/rbac";
import { getCurrentSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      ...session,
      permissions: getPermissionsForRole(session.role, session.customRoleCode),
    },
  });
}
