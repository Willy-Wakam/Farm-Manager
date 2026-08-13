import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cn } from "./utils";

describe("cn", () => {
  it("merges conditional class names", () => {
    assert.equal(
      cn("flex", false && "hidden", ["items-center", "gap-2"]),
      "flex items-center gap-2",
    );
  });

  it("resolves Tailwind class conflicts with the latest value", () => {
    assert.equal(cn("px-2 py-1", "px-4"), "py-1 px-4");
  });
});
