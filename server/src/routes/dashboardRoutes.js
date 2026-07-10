import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { clinicWhere, selectedClinicId } from "../clinicScope.js";

export const dashboardRoutes = Router();

const DEFAULT_ANALYSIS_QUOTA = 50;

dashboardRoutes.get("/analysis-counts", requireAuth, async (req, res, next) => {
  try {
    const parsedDays = Number.parseInt(String(req.query.days || "7"), 10);
    const days = Number.isInteger(parsedDays) ? Math.min(Math.max(parsedDays, 1), 31) : 7;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const events = await prisma.analysisEvent.findMany({
      where: { createdAt: { gte: start }, ...clinicWhere(req) },
      select: { createdAt: true }
    });
    const clinicId = selectedClinicId(req);
    const usedByClinic = clinicId ? await prisma.analysisEvent.count({ where: { clinicId } }) : null;

    const counts = new Map();
    for (const event of events) {
      const key = event.createdAt.toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const series = [];
    for (let index = days - 1; index >= 0; index -= 1) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - index);
      const key = date.toISOString().slice(0, 10);
      series.push({
        date: key,
        label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        count: counts.get(key) || 0
      });
    }

    return res.json({
      days: series,
      total: series.reduce((sum, item) => sum + item.count, 0),
      remainingAnalyses: usedByClinic === null ? null : Math.max(DEFAULT_ANALYSIS_QUOTA - usedByClinic, 0)
    });
  } catch (error) {
    next(error);
  }
});
