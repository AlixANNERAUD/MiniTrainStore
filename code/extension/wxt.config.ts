import { defineConfig } from "wxt";
import { homedir } from "os";
import { join } from "path";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-vue"],
  manifest: {
    permissions: ["storage"],
    host_permissions: [
      "*://*.leboncoin.fr/*",
      // Allow connections to any domain for Odoo API calls
      "https://*/*",
      "http://*/*",
    ],
  },
  webExt: {
    chromiumArgs: [
      // Bypass bot detection systems (e.g., DataDome on leboncoin.fr)
      // This prevents navigator.webdriver from being set to true
      "--disable-blink-features=AutomationControlled",
      "--user-data-dir=./.wxt/chrome-data",
    ],
    keepProfileChanges: true,
  },
});
