import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 6969
  },
  test: {
    include: ["**/*.eval.?(c|m)[jt]s"],
    reporters: ["langsmith/vitest/reporter"],
    setupFiles: ["dotenv/config"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
