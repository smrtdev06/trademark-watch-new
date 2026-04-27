import { Router, type IRouter } from "express";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.post("/assessment/export", requireAuth, async (_req, res): Promise<void> => {
  res.json({ status: 200, file: "export_assessment.xlsx" });
});

router.post("/assessment/risk-scoring", requireAuth, async (req, res): Promise<void> => {
  const { keyword } = req.body;
  res.json({
    overallScore: 0,
    dropOutRate: 0,
    renewalRate: 0,
    exactVsVariation: {},
    userDetails: {},
  });
});

export default router;
