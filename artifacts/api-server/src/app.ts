import express, { type Express } from "express";
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

export default app;
