import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

const allowedOrigins = (() => {
  const domains = process.env.REPLIT_DOMAINS ?? "";
  const origins = domains
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .flatMap((d) => [`https://${d}`, `http://${d}`]);
  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost", "http://localhost:3000", "http://localhost:19006");
  }
  return origins;
})();

app.use(
  cors({
    credentials: true,
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  }),
);
const BUG_REPORTS_PATH = "/api/bug-reports";
const BUG_REPORTS_BODY_LIMIT = "10kb";
const DEFAULT_BODY_LIMIT = "20mb";

app.use((req, res, next) => {
  const isBugReport =
    req.method === "POST" && req.path === BUG_REPORTS_PATH;
  express.json({ limit: isBugReport ? BUG_REPORTS_BODY_LIMIT : DEFAULT_BODY_LIMIT })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: DEFAULT_BODY_LIMIT }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

const analysisErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (req.path !== "/api/analyze-video" || res.headersSent) {
    next(error);
    return;
  }
  const status = error?.status === 413 ? 413 : error?.type === "entity.parse.failed" ? 400 : 500;
  req.log.error({ status, errorType: error?.type }, "Analysis request failed outside route handler");
  res.status(status).json({
    ok: false,
    error: status === 413 ? "This video request is too large. Please use a smaller clip."
      : status === 400 ? "The video request could not be read. Please try again."
        : "We couldn't analyze this video. Please try again.",
  });
};
app.use(analysisErrorHandler);

export default app;
