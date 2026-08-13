import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatFCFA } from "./format";

describe("formatFCFA", () => {
  it("formats XAF amounts without decimals", () => {
    const formatted = formatFCFA(1_234_567);

    assert.match(formatted, /FCFA$/);
    assert.equal(formatted.replace(/\D/g, ""), "1234567");
    assert.doesNotMatch(formatted, /[,.]00\b/);
  });

  it("keeps negative amounts explicit", () => {
    const formatted = formatFCFA(-25_000);

    assert.match(formatted, /FCFA$/);
    assert.equal(formatted.replace(/\D/g, ""), "25000");
    assert.ok(formatted.includes("-") || formatted.includes("−"));
  });
});
