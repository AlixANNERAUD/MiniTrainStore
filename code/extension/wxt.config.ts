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
    permissions: ["storage", "sidePanel"],
    host_permissions: ["<all_urls>"],
    sidebar_action: {
      default_panel: "sidepanel.html",
      default_title: "Mini Train Store",
      default_icon: "icon/128.png",
    },
    side_panel: {
      default_path: "sidepanel.html",
    },
    browser_specific_settings: {
      gecko: {
        id: "@volte",
      },
    },
  },
  webExt: {
    chromiumProfile: chromeDataPath,
    firefoxProfile: firefoxDataPath,
    chromiumArgs: [
      // Bypass bot detection systems (e.g., DataDome on leboncoin.fr)
      // This prevents navigator.webdriver from being set to true
      "--disable-blink-features=AutomationControlled",
      "--user-data-dir=./.wxt/chrome-data",
    ],
    keepProfileChanges: true,
  },
});
