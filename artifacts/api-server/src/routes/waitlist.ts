import { Router } from "express";
import { z } from "zod";
import { db, waitlist } from "@workspace/db";
import { Resend } from "resend";

const router = Router();

const joinWaitlistSchema = z.object({
  email: z.string().email(),
  source: z.string().optional(),
});

async function sendWelcomeEmail(email: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: "Shot Doc <hello@shotdoc.app>",
    to: email,
    subject: "You're on the list 🏀",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're on the Shot Doc waitlist</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#111111;border-radius:12px;overflow:hidden;max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background-color:#00C853;padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:3px;color:#000000;text-transform:uppercase;">Shot Doc</p>
              <h1 style="margin:8px 0 0;font-size:28px;font-weight:800;color:#000000;letter-spacing:-0.5px;">You're on the list.</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#e0e0e0;">
                Thanks for signing up for the Shot Doc beta. We're building an AI-powered shooting form analyzer that gives you real biomechanics feedback — frame by frame.
              </p>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#e0e0e0;">
                We'll reach out as soon as it's your turn. In the meantime, keep shooting.
              </p>
              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0;">
                <tr>
                  <td style="border-top:1px solid #222222;"></td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#555555;line-height:1.6;">
                You're receiving this because you joined the Shot Doc waitlist. If this was a mistake, you can ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:0 40px 32px;">
              <p style="margin:0;font-size:12px;color:#333333;">© 2026 Shot Doc. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });

  if (error) {
    throw new Error(`Resend API error: ${error.message}`);
  }
}

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

    if (!alreadyRegistered) {
      try {
        await sendWelcomeEmail(email);
      } catch (emailErr) {
        req.log.error({ err: emailErr }, "Failed to send welcome email");
      }
    }

    res.status(200).json({ success: true, alreadyRegistered });
  } catch (err) {
    req.log.error({ err }, "Failed to insert waitlist entry");
    res.status(500).json({ error: "Failed to join waitlist. Please try again." });
  }
});

export default router;
