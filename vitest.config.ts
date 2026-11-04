import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    clearMocks: true,
    coverage: {
      provider: "v8",
      include: [
        "src/services/products.service.ts",
        "src/controllers/products.controller.ts",
        "src/services/categories.service.ts",
        "src/controllers/categories.controller.ts",
        "src/utils/validators.ts",
        "src/utils/slug.ts",
      ],
      reporter: ["text", "html"],
    },
  },
});
