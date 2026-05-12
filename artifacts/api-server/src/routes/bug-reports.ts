import { Router } from "express";
import { getAuth } from "@clerk/express";
import { z } from "zod";
import { db, bugReports } from "@workspace/db";

const router = Router();

const deviceInfoValueSchema = z.union([
  z.string().max(200),
  z.number(),
  z.boolean(),
  z.null(),
]);

const deviceInfoSchema = z
  .record(z.string().max(50), deviceInfoValueSchema)
  .refine((val) => Object.keys(val).length <= 20, {
    message: "deviceInfo may have at most 20 keys",
  })
  .optional();

const createBugReportSchema = z.object({
  message: z.string().min(1).max(2000),
  deviceInfo: deviceInfoSchema,
});

router.post("/bug-reports", async (req, res) => {
  const parsed = createBugReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { message, deviceInfo } = parsed.data;

  let userId: string | null = null;
  try {
    const auth = getAuth(req);
    userId = auth.userId ?? null;
  } catch {
    // unauthenticated — allow anonymous reports
  }

  try {
    const [inserted] = await db
      .insert(bugReports)
      .values({
        userId,
        message,
        deviceInfo: deviceInfo ?? null,
      })
      .returning({ id: bugReports.id, createdAt: bugReports.createdAt });

    res.status(201).json({
      id: inserted.id,
      createdAt: inserted.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to insert bug report");
    res.status(500).json({ error: "Failed to submit report. Please try again." });
  }
});

export default router;
