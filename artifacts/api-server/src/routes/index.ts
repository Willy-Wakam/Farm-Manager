import { Router, type IRouter } from "express";
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

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/financement", financementRouter);
router.use("/devis", devisRouter);
router.use("/depenses", depensesRouter);
router.use("/bandes", bandesRouter);
router.use("/dashboard", dashboardRouter);
router.use("/activity-log", activityLogRouter);
router.use("/parametres", parametresRouter);
router.use("/stocks", stocksRouter);
router.use("/import-historical", importHistoricalRouter);
router.use("/ocr-fiche", ocrFicheRouter);
router.use("/chantiers", chantiersRouter);
router.use("/actifs", actifsRouter);

export default router;
