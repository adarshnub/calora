import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config";
export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ["tests/database/**/*.test.ts"],
      fileParallelism: false,
      testTimeout: 30000,
    },
  }),
);
