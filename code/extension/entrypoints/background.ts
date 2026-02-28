import { createOdooService, OdooConfig } from "@/utilities/odoo";

export default defineBackground(() => {
  console.log("Background script started", { id: browser.runtime.id });
});
