import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analyzeRouter from "./analyze";
import analyzeVideoRouter from "./analyze-video";
import bugReportsRouter from "./bug-reports";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analyzeRouter);
router.use(analyzeVideoRouter);
router.use(bugReportsRouter);
router.use(adminRouter);

export default router;
