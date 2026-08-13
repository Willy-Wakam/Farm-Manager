import { Router, type IRouter, type RequestHandler } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import financementRouter from "./financement";
import devisRouter from "./devis";
import depensesRouter from "./depenses";
import bandesRouter from "./bandes";
import dashboardRouter from "./dashboard";
import activityLogRouter from "./activity-log";
import parametresRouter from "./parametres";
import stocksRouter from "./stocks";
import importHistoricalRouter from "./import-historical";
import ocrFicheRouter from "./ocr-fiche";
import chantiersRouter from "./chantiers";
import actifsRouter from "./actifs";
import {
  allowRoles,
  requireAuth,
  type UserRole,
} from "./require-auth";

const router: IRouter = Router();

const allRoles: UserRole[] = [
  "admin",
  "investisseur",
  "gestionnaire",
  "lecteur",
];
const adminOnly: UserRole[] = ["admin"];
const operationalRoles: UserRole[] = ["admin", "gestionnaire"];
const readMethods = new Set(["GET", "HEAD"]);

function allowReadWrite(
  readRoles: UserRole[],
  writeRoles: UserRole[],
): RequestHandler {
  return (req, res, next) => {
    const roles = readMethods.has(req.method)
      ? readRoles
      : writeRoles;

    return allowRoles(...roles)(req, res, next);
  };
}

router.use(healthRouter);
router.use("/auth", authRouter);
router.use(requireAuth);
router.use(
  "/financement",
  allowReadWrite(allRoles, adminOnly),
  financementRouter,
);
router.use("/devis", allowRoles(...operationalRoles), devisRouter);
router.use(
  "/depenses",
  allowReadWrite(allRoles, operationalRoles),
  depensesRouter,
);
router.use(
  "/bandes",
  allowReadWrite(allRoles, operationalRoles),
  bandesRouter,
);
router.use("/dashboard", allowRoles(...allRoles), dashboardRouter);
router.use("/activity-log", allowRoles(...adminOnly), activityLogRouter);
router.use(
  "/parametres",
  allowReadWrite(allRoles, adminOnly),
  parametresRouter,
);
router.use("/stocks", allowRoles(...operationalRoles), stocksRouter);
router.use(
  "/import-historical",
  allowRoles(...adminOnly),
  importHistoricalRouter,
);
router.use("/ocr-fiche", allowRoles(...operationalRoles), ocrFicheRouter);
router.use("/chantiers", allowRoles(...operationalRoles), chantiersRouter);
router.use(
  "/actifs",
  allowReadWrite(allRoles, operationalRoles),
  actifsRouter,
);

export default router;
