import { waitForProfilePageLoad } from "@/utilities/profile/navigation";
import { getProfileIdentifierFromUrl } from "@/utilities/profile/location";
import { getProductIdentifierFromUrl } from "@/utilities/product/location";
import {
  scrapeProductDetails,
  waitForProductPageLoad,
} from "@/utilities/product/navigation";
import { setupProfileButton } from "./content/profile-button";
import { ContentScriptContext } from "wxt/utils/content-script-context";
import { setupProductButton } from "./content/product-button";

let profileButtonUi: ShadowRootContentScriptUi<void> | null = null;
let productButtonUi: ShadowRootContentScriptUi<void> | null = null;

export default defineContentScript({
  matches: ["*://*.leboncoin.fr/*"],
  main(ctx) {
    console.log("Leboncoin scraper loaded");

    // Initial page check
    checkAndHandlePage(ctx);
    // Listen for URL changes (for SPA navigation)
    let lastUrl = location.href;
    new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;

        // Check the new page
        checkAndHandlePage(ctx);
      }
    }).observe(document, { subtree: true, childList: true });
  },
});

function checkAndHandlePage(ctx: ContentScriptContext) {
  // Check if we're on a profile page
  const url = new URL(window.location.href);

  const userIdentifier = getProfileIdentifierFromUrl(url);
  const productIdentifier = getProductIdentifierFromUrl(url);

  if (profileButtonUi) {
    profileButtonUi.remove();
    profileButtonUi = null;
  }

  if (productButtonUi) {
    productButtonUi.remove();
    productButtonUi = null;
  }

  if (userIdentifier) {
    // Wait for page to load, then scrape automatically
    waitForProfilePageLoad().then(() => {
      setupProfileButton(ctx).then((ui) => {
        profileButtonUi = ui;
      });
    });
  } else if (productIdentifier) {
    // Wait for page to load, then scrape details
    waitForProductPageLoad().then(() => {
      setupProductButton(ctx).then((ui) => {
        productButtonUi = ui;
      });
      scrapeProductDetails();
    });
  }
}
