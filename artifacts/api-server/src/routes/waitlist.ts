import { Router } from "express";
import { z } from "zod";
import { db, waitlist } from "@workspace/db";

const router = Router();

const joinWaitlistSchema = z.object({
  email: z.string().email(),
  source: z.string().optional(),
});

router.post("/waitlist", async (req, res) => {
  const parsed = joinWaitlistSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  const { email, source } = parsed.data;

  try {
    const result = await db
      .insert(waitlist)
      .values({ email, source: source ?? "landing" })
      .onConflictDoNothing({ target: waitlist.email })
      .returning({ id: waitlist.id });

    const alreadyRegistered = result.length === 0;
    res.status(200).json({ success: true, alreadyRegistered });
  } catch (err) {
    req.log.error({ err }, "Failed to insert waitlist entry");
    res.status(500).json({ error: "Failed to join waitlist. Please try again." });
  }
});

export default router;
