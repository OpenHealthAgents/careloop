import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { prisma } from "@/lib/db";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { recordAuditEvent } from "@/services/audit-service";

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(10, "Password must be at least 10 characters"),
  role: z.nativeEnum(UserRole),
});

const UpdateUserSchema = z.object({
  userId: z.string().min(1),
  role: z.nativeEnum(UserRole).optional(),
  active: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, PERMISSIONS.USERS_MANAGE);
    const users = await prisma.user.findMany({
      where: { tenantId: session.tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ users });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { session, correlationId } = await requireRequestContext(
      request,
      PERMISSIONS.USERS_MANAGE
    );
    const body = CreateUserSchema.parse(await request.json());

    const existing = await prisma.user.findUnique({
      where: {
        tenantId_email: { tenantId: session.tenantId, email: body.email.toLowerCase() },
      },
    });
    if (existing) {
      throw new ConflictError("User with this email already exists in tenant");
    }

    const roleEntity = await prisma.role.findFirst({
      where: { tenantId: session.tenantId, code: body.role },
    });

    const user = await prisma.user.create({
      data: {
        tenantId: session.tenantId,
        roleId: roleEntity?.id ?? null,
        email: body.email.toLowerCase(),
        name: body.name,
        passwordHash: hashPassword(body.password),
        role: body.role,
        active: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    await recordAuditEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      source: "USER_ADMIN",
      newState: { role: user.role, active: user.active },
      correlationId,
      summary: `Created tenant user with role ${user.role}`,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const { session, correlationId } = await requireRequestContext(
      request,
      PERMISSIONS.USERS_MANAGE
    );
    const body = UpdateUserSchema.parse(await request.json());

    const target = await prisma.user.findFirst({
      where: { id: body.userId, tenantId: session.tenantId },
    });
    if (!target) throw new NotFoundError("User", body.userId);

    if (target.id === session.userId) {
      if (body.active === false) {
        throw new ValidationError("Administrators cannot deactivate their own account.");
      }
      if (body.role && body.role !== target.role) {
        throw new ValidationError("Administrators cannot modify their own role.");
      }
    }

    const roleEntity = body.role
      ? await prisma.role.findFirst({
          where: { tenantId: session.tenantId, code: body.role },
        })
      : null;

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        ...(body.role ? { role: body.role, roleId: roleEntity?.id ?? target.roleId } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
      },
    });

    if (body.active === false) {
      await prisma.userSession.updateMany({
        where: { userId: target.id, tenantId: session.tenantId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await recordAuditEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: target.id,
      source: "USER_ADMIN",
      previousState: { role: target.role, active: target.active },
      newState: { role: updated.role, active: updated.active },
      correlationId,
      summary: `Updated user role=${updated.role} active=${updated.active}`,
    });

    return NextResponse.json({ user: updated });
  } catch (err) {
    return toErrorResponse(err);
  }
}
