import { parseProfilePage } from "@/utilities/profile/parsing";
import {
  waitForProfilePageLoad,
  scrapeProfileCurrentPage,
} from "@/utilities/profile/navigation";
import { getProfileIdentifierFromUrl } from "@/utilities/profile/location";
import { getProductIdentifierFromUrl } from "@/utilities/product/location";
import { useSettingsStore } from "@/stores/settings";
import {
  scrapeProductDetails,
  waitForProductPageLoad,
} from "@/utilities/product/navigation";
import { setupProfileButton } from "./content/profile-button";
import { ContentScriptContext } from "wxt/utils/content-script-context";
import { setupProductButton } from "./content/product-button";

let isObserving = false;

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
        console.log("URL changed to:", currentUrl);

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

  console.log("User Identifier:", userIdentifier);
  console.log("Product Identifier:", productIdentifier);

  const settings = useSettingsStore();

  if (profileButtonUi) {
    profileButtonUi.remove();
    profileButtonUi = null;
  }

  if (productButtonUi) {
    productButtonUi.remove();
    productButtonUi = null;
  }

  if (userIdentifier) {
    console.log(`On profile page for user: ${userIdentifier}`);

    // Wait for page to load, then scrape automatically
    waitForProfilePageLoad().then(() => {
      setupProfileButton(ctx).then((ui) => {
        profileButtonUi = ui;
      });
    });
  } else if (productIdentifier) {
    console.log("On ad detail page");

    // Wait for page to load, then scrape details
    waitForProductPageLoad().then(() => {
      setupProductButton(ctx).then((ui) => {
        productButtonUi = ui;
      });
      scrapeProductDetails();
    });
  }
}

function setupPaginationWatcher(
  settings: ReturnType<typeof useSettingsStore>,
  username: string,
) {
  if (isObserving) return;
  isObserving = true;

  // Watch for new articles being added to the DOM
  const observer = new MutationObserver(() => {
    const userIdentifier = getProfileIdentifierFromUrl(
      new URL(window.location.href),
    );

    if (userIdentifier !== username) {
      console.log("Profile changed, stopping observer");
      observer.disconnect();
      isObserving = false;
      return;
    }

    // Debounce the scraping - only scrape after changes settle
    clearTimeout((window as any).__scrapeTimeout);

    (window as any).__scrapeTimeout = setTimeout(async () => {
      const products = parseProfilePage();

      console.log(
        "Detected pagination change, scraped products:",
        Object.keys(products).length,
      );

      if (Object.keys(products).length > 0) {
        await settings.updateProductListing(username, products.products);

        // if (stats.added > 0 || stats.updated > 0) {
        //   showNotification(
        //     `${stats.updated} mis à jour / ${stats.added} ajouté${stats.added > 1 ? "s" : ""}`,
        //   );
        //   console.log(`📄 ${stats.added} added, ${stats.updated} updated`);
        // }
      }
    }, 1000);
  });

  // Observe the main content area for changes
  const targetNode = document.body;
  observer.observe(targetNode, {
    childList: true,
    subtree: true,
  });

  console.log("👁️ Watching for pagination changes...");
}

function showNotification(message: string) {
  const notification = document.createElement("div");
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    padding: 12px 24px;
    background: #4ade80;
    color: white;
    border-radius: 8px;
    font-size: 14px;
    font-weight: bold;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    animation: slideIn 0.3s ease-out;
  `;

  // Add animation
  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = "slideIn 0.3s ease-out reverse";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
