import {
  parseProfileName,
  parseProfilePage,
  scrapeAdDetails,
} from "@/utilities/profile/parsing";
import {
  ProductListing,
  ProductDetail,
  ProductState,
} from "@/utilities/product";
import {
  scrapeAllProfilePages,
  waitForProfilePageLoad,
} from "@/utilities/profile/navigation";
import { extractProfileIdentifierFromUrl } from "@/utilities/profile/location";
import { getProductIdentifierFromUrl } from "@/utilities/product/location";
import { useSettingsStore } from "@/stores/settings";

let isObserving = false;
let detailsScraped = false;

export default defineContentScript({
  matches: ["*://*.leboncoin.fr/*"],
  main() {
    console.log("Leboncoin scraper loaded");

    // Initial page check
    checkAndHandlePage();

    // Listen for URL changes (for SPA navigation)
    let lastUrl = location.href;
    new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log("URL changed to:", currentUrl);

        // Reset detailsScraped flag on URL change
        detailsScraped = false;

        // Check the new page
        checkAndHandlePage();
      }
    }).observe(document, { subtree: true, childList: true });
  },
});

function checkAndHandlePage() {
  // Check if we're on a profile page
  let url = new URL(window.location.href);

  const userIdentifier = extractProfileIdentifierFromUrl(url);
  const productIdentifier = getProductIdentifierFromUrl(url);

  const settings = useSettingsStore();

  if (userIdentifier) {
    console.log(`On profile page for user: ${userIdentifier}`);

    // Wait for page to load, then scrape automatically
    waitForProfilePageLoad().then(() => {
      addScrapeButton(settings, userIdentifier);
      autoScrape(settings, userIdentifier);
      setupPaginationWatcher(settings, userIdentifier);
    });
  } else if (productIdentifier) {
    console.log("On ad detail page");

    // Wait for page to load, then scrape details
    waitForProductPageLoad().then(() => {
      scrapeAdDetails();
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
  const observer = new MutationObserver((mutations) => {
    const userIdentifier = extractProfileIdentifierFromUrl(
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
        const stats = await settings.updateProductListing(username, products);

        if (stats.added > 0 || stats.updated > 0) {
          showNotification(
            `${stats.updated} mis à jour / ${stats.added} ajouté${stats.added > 1 ? "s" : ""}`,
          );
          console.log(`📄 ${stats.added} added, ${stats.updated} updated`);
        }
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

function addScrapeButton(
  settings: ReturnType<typeof useSettingsStore>,
  username: string,
) {
  // Remove existing button if any
  const existingButton = document.getElementById("leboncoin-scraper-button");
  if (existingButton) {
    existingButton.remove();
  }

  const button = document.createElement("button");
  button.id = "leboncoin-scraper-button";
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px;">
      <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
    </svg>
    Scraper cette page
  `;
  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    padding: 12px 20px;
    background: #ff6e14;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(255, 110, 20, 0.3);
    display: flex;
    align-items: center;
    transition: all 0.2s;
  `;

  button.addEventListener("mouseenter", () => {
    button.style.transform = "translateY(-2px)";
    button.style.boxShadow = "0 6px 16px rgba(255, 110, 20, 0.4)";
  });

  button.addEventListener("mouseleave", () => {
    button.style.transform = "translateY(0)";
    button.style.boxShadow = "0 4px 12px rgba(255, 110, 20, 0.3)";
  });

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.innerHTML =
      '<div style="width: 16px; height: 16px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 6px;"></div> Scraping...';

    // Add animation
    const style = document.createElement("style");
    style.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(style);

    // Scrape all pages with pagination
    const allProducts = await scrapeAllProfilePages(username, (page, total) => {
      button.innerHTML = `<div style="width: 16px; height: 16px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 6px;"></div> Page ${page}/${total}...`;
    });

    const stats = await settings.updateProductListing(username, allProducts);

    button.innerHTML = `✓ ${stats.added} ajouté${stats.added > 1 ? "s" : ""} / ${stats.updated} MAJ`;
    setTimeout(() => {
      button.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px;"><path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/></svg>Scraper cette page`;
      button.disabled = false;
    }, 2000);
  });

  document.body.appendChild(button);
}

async function autoScrape(
  settings: ReturnType<typeof useSettingsStore>,
  userIdentifier: string,
) {
  console.log(`Auto-scraping profile: ${userIdentifier}`);

  const profileData = parseProfilePage();

  if (profileData.products && Object.keys(profileData.products).length > 0) {
    const stats = await settings.updateProductListing(
      userIdentifier,
      profileData.username,
      profileData.products,
      true,
    );
    console.log(
      `✓ Saved products for ${profileData.username}: ${stats.added} added, ${stats.updated} updated`,
    );
    if (stats.added > 0 || stats.updated > 0) {
      showNotification(
        `${stats.updated} mis à jour / ${stats.added} ajouté${stats.added > 1 ? "s" : ""}`,
      );
    }
  }
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
