import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./routes";
import { logger } from "./lib/logger";

const PgStore = connectPgSimple(session);

function resolveSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 32 characters in production. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }

  logger.warn(
    "SESSION_SECRET is missing or too short — using a random secret for this dev run. Sessions will be lost on restart.",
  );
  return crypto.randomBytes(32).toString("hex");
}

const sessionSecret = resolveSessionSecret();

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
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new PgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
      tableName: "session",
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    },
  }),
);

app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  const currentDir = path.dirname(
    fileURLToPath(import.meta.url),
  );

  const webDistPath = path.resolve(
    currentDir,
    "../../web/dist",
  );

  app.use(express.static(webDistPath));

  app.use((req, res, next) => {
    if (
      req.method !== "GET" ||
      req.originalUrl === "/api" ||
      req.originalUrl.startsWith("/api/")
    ) {
      next();
      return;
    }

    res.sendFile("index.html", {
      root: webDistPath,
    });
  });
}

export default app;
