import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@workspace/motion": path.resolve(__dirname, "../../packages/motion/src/index.ts"),
      "@workspace/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@": __dirname,
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
