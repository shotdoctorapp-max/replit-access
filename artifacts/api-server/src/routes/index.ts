import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analyzeRouter from "./analyze";
import analyzeVideoRouter from "./analyze-video";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analyzeRouter);
router.use(analyzeVideoRouter);

export default router;
