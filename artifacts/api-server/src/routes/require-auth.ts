import type { Request, RequestHandler } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type SessionWithUser = Request["session"] & {
  userId?: number;
};

export const USER_ROLES = [
  "admin",
  "investisseur",
  "gestionnaire",
  "lecteur",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function getSessionUserId(req: Request): number | undefined {
  return (req.session as SessionWithUser | undefined)?.userId;
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!getSessionUserId(req)) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  next();
};

function isUserRole(role: string): role is UserRole {
  return (USER_ROLES as readonly string[]).includes(role);
}

export function allowRoles(...allowedRoles: UserRole[]): RequestHandler {
  return async (req, res, next) => {
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Non authentifié" });
      return;
    }

    const users = await db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    const role = users[0]?.role;

    if (!role) {
      res.status(401).json({ error: "Utilisateur introuvable" });
      return;
    }

    if (!isUserRole(role) || !allowedRoles.includes(role)) {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }

    next();
  };
}

export const requireRole = allowRoles;
