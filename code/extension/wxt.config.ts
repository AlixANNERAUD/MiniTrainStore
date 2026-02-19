import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path"; // Import path for cross-platform safety
import { existsSync, mkdirSync } from "fs";

const chromeDataPath = path.resolve(".wxt/chrome-data");
const firefoxDataPath = path.resolve(".wxt/firefox-data");

if (!existsSync(chromeDataPath)) {
  mkdirSync(chromeDataPath, { recursive: true });
}

if (!existsSync(firefoxDataPath)) {
  mkdirSync(firefoxDataPath, { recursive: true });
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  modules: ["@wxt-dev/module-vue"],
  manifest: {
    name: "Mini Train Store",
    version: "0.1.0",
    description:
      "Une extension pour suivre les prix des produits sur différents sites de e-commerce.",
    permissions: ["storage"],
    host_permissions: ["<all_urls>"],
    browser_specific_settings: {
      gecko: {
        id: "@volte",
      },
    },
  },
  webExt: {
    chromiumProfile: chromeDataPath,
    firefoxProfile: firefoxDataPath,
    keepProfileChanges: true,
  },
});
