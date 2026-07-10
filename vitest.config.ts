import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "data/**/*.test.ts", "app/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      exclude: ["lib/**/*.test.ts", "lib/supabase/**"],
      reporter: ["text", "html"],
    },
    // Force file-level sequential execution — registry tests rely
    // on `afterEach(__resetRegistryForTests)` for cross-test
    // isolation. Documented as the assumption in lib/modules/
    // README.md. Closes ECC S1 TS-M2.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // The `server-only` marker package throws on default import
      // (it's a build-time-only guard for Next.js client/server
      // separation). Vitest doesn't know about the react-server
      // export condition that would resolve it to the no-op
      // variant. Alias it directly to the package's `empty.js`
      // so test files can import modules that include
      // `import "server-only"` without crashing. Closes ECC S1
      // Code-M2 test-runtime gap.
      "server-only": path.resolve(
        __dirname,
        "node_modules/server-only/empty.js",
      ),
    },
  },
});
