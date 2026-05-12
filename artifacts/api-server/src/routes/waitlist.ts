import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db, waitlist } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { rateLimit } from "express-rate-limit";

const router = Router();

const waitlistRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

const joinWaitlistSchema = z.object({
  email: z.string().email(),
  source: z.string().optional(),
});

function getAppBaseUrl(req: import("express").Request): string {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.replace(/\/$/, "");
  }
  const domains = process.env.REPLIT_DOMAINS ?? "";
  const primaryDomain = domains.split(",")[0]?.trim();
  if (primaryDomain) {
    return `https://${primaryDomain}`;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_BASE_URL or REPLIT_DOMAINS must be set in production");
  }
  const host = req.headers.host ?? "localhost";
  const proto = req.headers["x-forwarded-proto"] ?? "http";
  return `${proto}://${host}`;
}

async function sendConfirmationEmail(email: string, token: string, req: import("express").Request): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const base = getAppBaseUrl(req);
  const confirmUrl = `${base}/api/waitlist/confirm?token=${encodeURIComponent(token)}`;

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: "Shot Doc <hello@shotdoc.app>",
    to: email,
    subject: "Confirm your spot on the Shot Doc waitlist",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirm your Shot Doc waitlist spot</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#111111;border-radius:12px;overflow:hidden;max-width:560px;width:100%;">
          <tr>
            <td style="background-color:#00C853;padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:3px;color:#000000;text-transform:uppercase;">Shot Doc</p>
              <h1 style="margin:8px 0 0;font-size:28px;font-weight:800;color:#000000;letter-spacing:-0.5px;">Confirm your spot.</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#e0e0e0;">
                You signed up for the Shot Doc beta waitlist. Click the button below to confirm your email address and secure your spot.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td>
                    <a href="${confirmUrl}" style="display:inline-block;background-color:#00C853;color:#000000;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;padding:14px 28px;">
                      Confirm my spot
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;color:#666666;line-height:1.6;">
                Or paste this link into your browser:
              </p>
              <p style="margin:0 0 20px;font-size:12px;color:#555555;line-height:1.6;word-break:break-all;">
                ${confirmUrl}
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0;">
                <tr><td style="border-top:1px solid #222222;"></td></tr>
              </table>
              <p style="margin:0;font-size:13px;color:#555555;line-height:1.6;">
                If you didn't sign up for Shot Doc, you can safely ignore this email.
              </p>
            </td>
          </tr>
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
          <tr>
            <td style="background-color:#00C853;padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:3px;color:#000000;text-transform:uppercase;">Shot Doc</p>
              <h1 style="margin:8px 0 0;font-size:28px;font-weight:800;color:#000000;letter-spacing:-0.5px;">You're on the list.</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#e0e0e0;">
                Thanks for confirming your spot on the Shot Doc beta waitlist. We're building an AI-powered shooting form analyzer that gives you real biomechanics feedback — frame by frame.
              </p>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#e0e0e0;">
                We'll reach out as soon as it's your turn. In the meantime, keep shooting.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0;">
                <tr><td style="border-top:1px solid #222222;"></td></tr>
              </table>
              <p style="margin:0;font-size:13px;color:#555555;line-height:1.6;">
                You're receiving this because you confirmed your spot on the Shot Doc waitlist. If this was a mistake, you can ignore this email.
              </p>
            </td>
          </tr>
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

router.post("/waitlist", waitlistRateLimit, async (req, res) => {
  const parsed = joinWaitlistSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  const { email, source } = parsed.data;
  const token = randomUUID();

  try {
    const result = await db
      .insert(waitlist)
      .values({ email, source: source ?? "landing", confirmationToken: token })
      .onConflictDoNothing({ target: waitlist.email })
      .returning({ id: waitlist.id });

    const alreadyRegistered = result.length === 0;

    if (!alreadyRegistered) {
      try {
        await sendConfirmationEmail(email, token, req);
      } catch (emailErr) {
        req.log.error({ err: emailErr }, "Failed to send confirmation email");
      }
    }

    res.status(200).json({ success: true, alreadyRegistered });
  } catch (err) {
    req.log.error({ err }, "Failed to insert waitlist entry");
    res.status(500).json({ error: "Failed to join waitlist. Please try again." });
  }
});

router.get("/waitlist/confirm", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token.trim() : "";

  if (!token) {
    res.status(400).send(confirmationHtml("Invalid link", "This confirmation link is missing a token. Please use the link from your email."));
    return;
  }

  try {
    const rows = await db
      .select()
      .from(waitlist)
      .where(eq(waitlist.confirmationToken, token))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).send(confirmationHtml("Link not found", "This confirmation link has already been used or is invalid. You're all set if you already confirmed."));
      return;
    }

    const row = rows[0];

    if (row.confirmedAt) {
      res.status(200).send(confirmationHtml("Already confirmed", "Your email is already confirmed. We'll be in touch soon!"));
      return;
    }

    await db
      .update(waitlist)
      .set({ confirmedAt: new Date(), confirmationToken: null })
      .where(eq(waitlist.id, row.id));

    try {
      await sendWelcomeEmail(row.email);
    } catch (emailErr) {
      req.log.error({ err: emailErr }, "Failed to send welcome email after confirmation");
    }

    res.status(200).send(confirmationHtml("You're on the list!", "Your email is confirmed and you're officially on the Shot Doc beta waitlist. We'll be in touch when it's your turn."));
  } catch (err) {
    req.log.error({ err }, "Failed to confirm waitlist entry");
    res.status(500).send(confirmationHtml("Something went wrong", "We couldn't confirm your spot right now. Please try clicking the link in your email again."));
  }
});

function confirmationHtml(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Shot Doc</title>
  <style>
    body { margin: 0; padding: 0; background: #000; color: #f0f0f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #111; border: 1px solid #222; border-radius: 16px; padding: 48px 40px; max-width: 420px; text-align: center; }
    .logo { font-size: 13px; font-weight: 700; letter-spacing: 3px; color: #00C853; text-transform: uppercase; margin-bottom: 24px; }
    h1 { font-size: 26px; font-weight: 800; margin: 0 0 16px; letter-spacing: -0.5px; }
    p { font-size: 15px; line-height: 1.6; color: #aaa; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Shot Doc</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

export default router;
