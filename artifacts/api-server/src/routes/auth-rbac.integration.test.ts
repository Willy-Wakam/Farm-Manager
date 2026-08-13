import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import type { Express } from "express";

type UserRole = "admin" | "investisseur" | "gestionnaire" | "lecteur";

type QueryablePool = {
  query<T extends object = Record<string, unknown>>(
    sql: string,
  ): Promise<{ rows: T[] }>;
  end(): Promise<void>;
};

type CreatedUserResponse = {
  user: {
    id: number;
  };
};

type RequestOptions = {
  body?: unknown;
  cookie?: string;
};

function resolveTestDatabaseUrl(): string {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Integration tests must run with NODE_ENV=test.");
  }

  const databaseUrl =
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "Set TEST_DATABASE_URL or DATABASE_URL to a disposable PostgreSQL test database.",
    );
  }

  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(/^\//, "");

  if (!/test/i.test(databaseName)) {
    throw new Error(
      `Refusing to run integration tests against database "${databaseName}". Use a database name containing "test".`,
    );
  }

  if (/render/i.test(parsed.hostname)) {
    throw new Error("Refusing to run integration tests against a Render host.");
  }

  return databaseUrl;
}

process.env.DATABASE_URL = resolveTestDatabaseUrl();
process.env.SESSION_SECRET ??=
  "integration-test-session-secret-at-least-32-chars";
delete process.env.GEMINI_API_KEY;

let app: Express;
let pool: QueryablePool;
let server: Server;
let baseUrl: string;

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function resetDatabase() {
  const tableResult = await pool.query<{ tablename: string }>(
    `SELECT tablename
     FROM pg_tables
     WHERE schemaname = 'public'`,
  );

  const tableNames = tableResult.rows.map((row) => row.tablename);
  if (!tableNames.includes("users")) {
    throw new Error(
      "Test database schema is missing. Run `pnpm --filter @workspace/db run push` against the test database first.",
    );
  }

  if (tableNames.length === 0) return;

  await pool.query(
    `TRUNCATE TABLE ${tableNames
      .map(quoteIdentifier)
      .join(", ")} RESTART IDENTITY CASCADE`,
  );
}

function listenOnRandomPort(targetApp: Express): Promise<void> {
  return new Promise((resolve, reject) => {
    server = targetApp.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("Test server did not bind to a TCP port."));
        return;
      }

      baseUrl = `http://127.0.0.1:${address.port}/api`;
      resolve();
    });
  });
}

function closeServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function request(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const headers: Record<string, string> = {};
  const requestInit: RequestInit = {
    method,
    headers,
  };

  if (options.cookie) {
    headers.cookie = options.cookie;
  }

  if (options.body instanceof FormData) {
    requestInit.body = options.body;
  } else if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    requestInit.body = JSON.stringify(options.body);
  }

  return fetch(`${baseUrl}${path}`, requestInit);
}

function cookieFrom(response: Response): string {
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function login(username: string, password: string): Promise<string> {
  const response = await request("POST", "/auth/login", {
    body: { username, password },
  });

  assert.equal(response.status, 200);
  const cookie = cookieFrom(response);
  await response.text();

  assert.notEqual(cookie, "");
  return cookie;
}

async function createUser(
  adminCookie: string,
  username: string,
  role: Exclude<UserRole, "admin">,
) {
  const createResponse = await request("POST", "/auth/register", {
    cookie: adminCookie,
    body: {
      nom: username,
      username,
      password: "secret1",
    },
  });

  assert.equal(createResponse.status, 201);
  const created = await createResponse.json() as CreatedUserResponse;

  if (role === "lecteur") return;

  const roleResponse = await request(
    "PUT",
    `/auth/users/${created.user.id}/role`,
    {
      cookie: adminCookie,
      body: { role },
    },
  );

  assert.equal(roleResponse.status, 200);
  await roleResponse.text();
}

before(async () => {
  const dbModule = await import("@workspace/db");
  pool = dbModule.pool;

  await resetDatabase();

  const seedModule = await import("../lib/seed");
  await seedModule.seedDefaults();

  const appModule = await import("../app");
  app = appModule.default;

  await listenOnRandomPort(app);
});

after(async () => {
  if (server) {
    await closeServer();
  }

  if (pool) {
    await pool.end();
  }
});

test("auth and RBAC integration guards protect the MVP security surface", async () => {
  const suffix = Date.now();
  const adminCookie = await login("admin", "admin");

  const lecteurUsername = `lecteur_${suffix}`;
  const gestionnaireUsername = `gestionnaire_${suffix}`;

  await createUser(adminCookie, lecteurUsername, "lecteur");
  await createUser(adminCookie, gestionnaireUsername, "gestionnaire");

  const lecteurCookie = await login(lecteurUsername, "secret1");
  const gestionnaireCookie = await login(
    gestionnaireUsername,
    "secret1",
  );

  const unauthenticatedBusinessRoute = await request(
    "GET",
    "/financement",
  );
  assert.equal(unauthenticatedBusinessRoute.status, 401);

  const lecteurWrite = await request("POST", "/financement", {
    cookie: lecteurCookie,
    body: {
      nom: "Lecteur blocked",
      montant: 1000,
      date: "2026-08-13",
    },
  });
  assert.equal(lecteurWrite.status, 403);

  const gestionnaireAdminRoute = await request(
    "GET",
    "/activity-log",
    { cookie: gestionnaireCookie },
  );
  assert.equal(gestionnaireAdminRoute.status, 403);

  const adminAllowedRoute = await request("POST", "/financement", {
    cookie: adminCookie,
    body: {
      nom: "Admin allowed",
      montant: 1000,
      date: "2026-08-13",
    },
  });
  assert.equal(adminAllowedRoute.status, 201);

  const formData = new FormData();
  formData.set(
    "photo",
    new Blob(["not an image"], { type: "image/png" }),
    "fiche.png",
  );

  const unauthenticatedOcr = await request("POST", "/ocr-fiche", {
    body: formData,
  });
  assert.equal(unauthenticatedOcr.status, 401);

  const nonAdminUsersAdmin = await request("GET", "/auth/users", {
    cookie: lecteurCookie,
  });
  assert.equal(nonAdminUsersAdmin.status, 403);
});
