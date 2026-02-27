import { createOdooService, OdooConfig } from "@/services/odoo";

export default defineBackground(() => {
  console.log("Background script started", { id: browser.runtime.id });
});
