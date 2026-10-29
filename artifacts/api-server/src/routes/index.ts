import { Router, type IRouter } from "express";
import healthRouter from "./health";
import discordAuthRouter from "./discord-auth";
import etmProgressRouter from "./etm-progress";

const router: IRouter = Router();

router.use(healthRouter);
router.use(discordAuthRouter);
router.use(etmProgressRouter);

export default router;
