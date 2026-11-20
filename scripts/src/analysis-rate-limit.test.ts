import assert from "node:assert/strict";
import test, { mock } from "node:test";

test("phase requests do not use up the per-hour analysis allowance", async () => {
  mock.module("@clerk/express", { namedExports: { getAuth: () => ({ userId: "user_rate_test" }) } });
  const { analysisRateLimit } = await import("../../artifacts/api-server/src/middlewares/analysisRateLimit");
  const run = (mode: string): number => {
    let code = 0;
    let passed = false;
    const res = {
      setHeader() {},
      status(value: number) { code = value; return res; },
      json() { return res; },
    };
    analysisRateLimit({ body: { mode } } as never, res as never, () => { passed = true; });
    return passed ? 200 : code;
  };
  // 20 full analyses, each with three phase requests, all fit in one hour.
  for (let i = 0; i < 20; i++) {
    for (const mode of ["locate", "prepare", "refine-release", "analyze"]) assert.equal(run(mode), 200, `${mode} #${i}`);
  }
  assert.equal(run("analyze"), 429);
});
