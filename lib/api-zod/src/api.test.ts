import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HealthCheckResponse,
  LoginBody,
  LoginResponse,
} from "./index";

describe("generated API schemas", () => {
  it("accepts the health check payload served by the API", () => {
    assert.deepEqual(
      HealthCheckResponse.parse({ status: "ok" }),
      { status: "ok" },
    );
  });

  it("requires login credentials", () => {
    assert.deepEqual(
      LoginBody.parse({ username: "admin", password: "admin" }),
      { username: "admin", password: "admin" },
    );

    assert.throws(() => LoginBody.parse({ username: "admin" }));
  });

  it("rejects unknown user roles in login responses", () => {
    assert.doesNotThrow(() =>
      LoginResponse.parse({
        user: {
          id: 1,
          username: "admin",
          role: "admin",
          nom: "Administrateur",
        },
      }),
    );

    assert.throws(() =>
      LoginResponse.parse({
        user: {
          id: 1,
          username: "admin",
          role: "superadmin",
          nom: "Administrateur",
        },
      }),
    );
  });
});
