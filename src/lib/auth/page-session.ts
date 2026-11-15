import { redirect } from "next/navigation";
import { getPermissionsForRole, hasPermission, Permission } from "./rbac";
import { getCurrentSession, SessionUser } from "./session";

export interface AuthenticatedPageContext {
  session: SessionUser;
  permissions: Permission[];
}

export async function requirePageSession(requiredPermission?: Permission): Promise<AuthenticatedPageContext> {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  const permissions = getPermissionsForRole(session.role, session.customRoleCode);
  if (requiredPermission && !hasPermission(session.role, requiredPermission, session.customRoleCode)) {
    redirect("/?forbidden=1");
  }
  return { session, permissions };
}
