import type { Request, RequestHandler } from "express";

type SessionWithUser = Request["session"] & {
  userId?: number;
};

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
