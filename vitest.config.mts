import { defineConfig } from "vitest/config";

/**
 * Tests for the pure logic extracted during Phase 4B.
 *
 * Deliberately NOT a React Native component test setup. The bugs these guard
 * are arithmetic and parsing bugs — NaN slipping through a guard, a timezone
 * shifting a date across a month boundary, a populated object compared against
 * a string — and all of them live in plain functions that need no renderer.
 *
 * Testing those directly is both faster and a stronger signal than driving
 * them through a mocked component tree.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
});
