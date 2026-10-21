import { fileURLToPath } from "node:url";
import { defineNuxtConfig } from "nuxt/config";
import { useNuxt } from "nuxt/kit";

export default defineNuxtConfig({
  // Upstream E2E selectors use Chinese; the deployed Zbox UI defaults to English.
  hooks: {
    "modules:before"() {
      useNuxt().options.i18n.defaultLocale = "zh";
    },
  },
  plugins: [fileURLToPath(new URL("./plugins/e2e-test-driver.client", import.meta.url))],
});
