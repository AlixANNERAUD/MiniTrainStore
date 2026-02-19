import {
  ProductListing,
  ProductDetail,
  ProductState,
  Product,
} from "@/types/product";

let scrapedIds = new Set<string>();
let currentUsername: string | null = null;
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
  const isProfilePage = window.location.pathname.startsWith("/profile/");
  const isAdPage = window.location.pathname.match(/^\/ad\/[^\/]+\/\d+/);

  if (isProfilePage) {
    const username = extractUsername();
    if (username) {
      currentUsername = username;
      console.log(`On profile page for user: ${username}`);

      // Wait for page to load, then scrape automatically
      waitForPageLoad().then(() => {
        autoScrape(username);
        setupPaginationWatcher(username);
        addScrapeButton(username);
      });
    }
  } else if (isAdPage) {
    console.log("On ad detail page");

    // Wait for page to load, then scrape details
    waitForAdPageLoad().then(() => {
      scrapeAdDetails();
    });
  }
}

function extractUsername(): string | null {
  const match = window.location.pathname.match(/^\/profile\/([^\/]+)/);
  return match ? match[1] : null;
}

function extractProfileName(): string | null {
  // Try multiple selectors for the profile name
  const selectors = [
    "h1.text-headline-1",
    "h1.text-display-3",
    "#mainContent h1",
  ];

  for (const selector of selectors) {
    const elem = document.querySelector(selector);
    if (elem && elem.textContent?.trim()) {
      return elem.textContent.trim();
    }
  }

  return null;
}

async function waitForPageLoad(): Promise<void> {
  // Wait for articles to load
  return new Promise((resolve) => {
    const checkArticles = () => {
      const articles = document.querySelectorAll('article[data-test-id="ad"]');
      if (articles.length > 0) {
        resolve();
      } else {
        setTimeout(checkArticles, 500);
      }
    };

    // Start checking after a short delay
    setTimeout(checkArticles, 1000);
  });
}

async function waitForAdPageLoad(): Promise<void> {
  // Wait for ad details to load
  return new Promise((resolve) => {
    const checkContent = () => {
      // Check for description container and images
      const contentElem =
        document.querySelector('[data-qa-id="adview_description_container"]') ||
        document.querySelector('div[data-test-id="description"]');
      const imageContainer =
        document.querySelector('div[data-test-id="image-viewer"]') ||
        document.querySelector("button > img");

      if (contentElem || imageContainer) {
        resolve();
      } else {
        setTimeout(checkContent, 500);
      }
    };

    // Start checking after a short delay
    setTimeout(checkContent, 1000);
  });
}

function setupPaginationWatcher(username: string) {
  if (isObserving) return;
  isObserving = true;

  // Watch for new articles being added to the DOM
  const observer = new MutationObserver((mutations) => {
    // Only proceed if still on a profile page
    if (!window.location.pathname.startsWith("/profile/")) {
      return;
    }

    // Debounce the scraping - only scrape after changes settle
    clearTimeout((window as any).__scrapeTimeout);
    (window as any).__scrapeTimeout = setTimeout(async () => {
      const products = scrapeCurrentPage(true); // true = only new products
      if (products.length > 0) {
        const stats = await saveProducts(username, products);
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

async function scrapeAllPages(
  username: string,
  onProgress?: (current: number, total: number) => void,
): Promise<ProductListing[]> {
  const allProducts: ProductListing[] = [];
  const scrapedIdsSet = new Set<string>();

  // Get total number of pages
  const pageButtons = Array.from(
    document.querySelectorAll('button[data-test-id="page-button"]'),
  );
  const totalPages = pageButtons.length;

  console.log(`Found ${totalPages} pages to scrape`);

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.(pageNum, totalPages);

    // Scrape current page
    const products = scrapeCurrentPage(false);
    products.forEach((p) => {
      if (!scrapedIdsSet.has(p.id)) {
        allProducts.push(p);
        scrapedIdsSet.add(p.id);
      }
    });

    console.log(
      `Scraped page ${pageNum}/${totalPages}: ${products.length} products`,
    );

    // Navigate to next page if not the last one
    if (pageNum < totalPages) {
      const nextPageButton = document.querySelector(
        `button[title="Page ${pageNum + 1}"]`,
      ) as HTMLButtonElement;
      if (nextPageButton && !nextPageButton.disabled) {
        nextPageButton.click();
        // Wait for page to load
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        console.log("No next page button found or disabled");
        break;
      }
    }
  }

  // Mark missing products as REMOVED
  await markMissingProductsAsRemoved(username, scrapedIdsSet);

  return allProducts;
}

async function markMissingProductsAsRemoved(
  username: string,
  currentIds: Set<string>,
) {
  await browser.runtime.sendMessage({
    type: "MARK_MISSING_AS_REMOVED",
    username,
    currentIds: Array.from(currentIds),
  });
}

function addScrapeButton(username: string) {
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
    const allProducts = await scrapeAllPages(username, (page, total) => {
      button.innerHTML = `<div style="width: 16px; height: 16px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 6px;"></div> Page ${page}/${total}...`;
    });

    const stats = await saveProducts(username, allProducts);

    button.innerHTML = `✓ ${stats.added} ajouté${stats.added > 1 ? "s" : ""} / ${stats.updated} MAJ`;
    setTimeout(() => {
      button.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px;"><path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/></svg>Scraper cette page`;
      button.disabled = false;
    }, 2000);
  });

  document.body.appendChild(button);
}

async function autoScrape(username: string) {
  // Safety check: only auto-scrape on profile pages
  if (!window.location.pathname.startsWith("/profile/")) {
    console.log("Not on profile page, skipping auto-scrape");
    return;
  }

  console.log(`Auto-scraping profile: ${username}`);

  const products = scrapeCurrentPage(false);

  if (products.length > 0) {
    const stats = await saveProducts(username, products);
    console.log(
      `✓ Saved products for ${username}: ${stats.added} added, ${stats.updated} updated`,
    );
    if (stats.added > 0 || stats.updated > 0) {
      showNotification(
        `${stats.updated} mis à jour / ${stats.added} ajouté${stats.added > 1 ? "s" : ""}`,
      );
    }
  }
}

async function saveProducts(username: string, products: ProductListing[]) {
  // Get profile name from the page
  const profileName = extractProfileName();

  // Send to background script for storage
  const response = await browser.runtime.sendMessage({
    type: "SAVE_PRODUCTS",
    username,
    profileName,
    products,
  });

  return response;
}

async function saveProductDetails(username: string, detail: ProductDetail) {
  // Send to background script for storage
  await browser.runtime.sendMessage({
    type: "SAVE_PRODUCT_DETAILS",
    username,
    detail,
  });
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

function parseArticle(article: Element): ProductListing | null {
  try {
    // Get the URL first to extract ID
    const linkElem = article.querySelector(
      'a[href^="/ad/"]',
    ) as HTMLAnchorElement;
    const relativeUrl = linkElem?.getAttribute("href") || "";
    const fullUrl = relativeUrl
      ? `https://www.leboncoin.fr${relativeUrl}`
      : "N/A";

    // Extract ID from URL (e.g., /ad/collection/3134818931 -> 3134818931)
    const idMatch = relativeUrl.match(/\/ad\/[^\/]+\/(\d+)/);
    const id = idMatch ? idMatch[1] : "";

    if (!id) {
      console.warn("Could not extract ID from URL:", relativeUrl);
      return null;
    }

    // Get the title
    const titleElem = article.querySelector('p[data-test-id="adcard-title"]');
    const title = titleElem?.textContent?.trim() || "N/A";

    // Get the price
    const priceElem = article.querySelector('span[data-qa-id="aditem_price"]');
    const priceText = priceElem?.textContent?.trim() || "0";
    const price = parseFloat(priceText.replace(/[^\d]/g, ""));

    // Get the thumbnail image
    const thumbnailElem = article.querySelector(
      'div[data-test-id="adcard-image"] img',
    ) as HTMLImageElement;
    const thumbnail = thumbnailElem?.getAttribute("src") || undefined;

    // Check if the product is sold
    let state = ProductState.ACTIVE;
    const soldBadge = article.querySelector('div[data-spark-component="tag"]');
    if (soldBadge && soldBadge.textContent?.trim() === "Vendu") {
      state = ProductState.SOLD;
    }

    // Get the date
    let datePosted = "N/A";
    try {
      const dateElem = article.querySelector('p[title*="202"]');
      if (dateElem) {
        datePosted = dateElem.textContent?.trim() || "N/A";
      }
    } catch (e) {
      console.error("Error parsing date:", e);
    }

    // Parse the date string (format: DD/MM/YYYY)
    let date = new Date().toISOString();
    if (datePosted !== "N/A") {
      try {
        const parts = datePosted.split("/");
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed
          const year = parseInt(parts[2], 10);
          const parsedDate = new Date(year, month, day);
          if (!isNaN(parsedDate.getTime())) {
            date = parsedDate.toISOString();
          }
        }
      } catch (e) {
        console.error("Error parsing date string:", e);
      }
    }

    return {
      id,
      title,
      price,
      url: fullUrl,
      datePosted,
      date,
      state,
      thumbnail,
    };
  } catch (e) {
    console.error("Error parsing article:", e);
    return null;
  }
}

function scrapeCurrentPage(onlyNew: boolean = false): ProductListing[] {
  // Safety check: only scrape on profile pages
  if (!window.location.pathname.startsWith("/profile/")) {
    console.log("Not on profile page, skipping scrape");
    return [];
  }

  const articles = document.querySelectorAll('article[data-test-id="ad"]');
  console.log(`Found ${articles.length} articles on current page`);

  const products: ProductListing[] = [];
  articles.forEach((article) => {
    const product = parseArticle(article);
    if (product) {
      // If onlyNew is true, skip already scraped IDs
      if (onlyNew && scrapedIds.has(product.id)) {
        return;
      }

      // Track this ID
      scrapedIds.add(product.id);
      products.push(product);
    }
  });

  if (onlyNew) {
    console.log(
      `Found ${products.length} new articles (${scrapedIds.size} total tracked)`,
    );
  }

  return products;
}

// ===== AD DETAIL PAGE SCRAPING =====

function extractAdId(): string | null {
  const match = window.location.pathname.match(/\/ad\/[^\/]+\/(\d+)/);
  return match ? match[1] : null;
}

function extractUsernameFromAdPage(): string | null {
  // Try to find the seller profile link
  const profileLink = document.querySelector(
    'a[href^="/profile/"]',
  ) as HTMLAnchorElement;
  if (profileLink) {
    const match = profileLink
      .getAttribute("href")
      ?.match(/^\/profile\/([^\/]+)/);
    return match ? match[1] : null;
  }
  return null;
}

function fixPhotoUrl(url: string | null): string {
  if (!url) return "";
  // Convert thumbnail URLs to full-size
  return url.replace(/ad-thumb/g, "ad-large").replace(/ad-small/g, "ad-large");
}

async function getPhotoUrls(): Promise<string[]> {
  const photos: string[] = [];

  // Look for gallery button and try to click it to get all photos
  const galleryButtons = Array.from(document.querySelectorAll("button"));
  const galleryButton = galleryButtons.find((btn) =>
    /Voir les \d+ photos?/i.test(btn.textContent || ""),
  );

  if (galleryButton) {
    try {
      galleryButton.click();
      // Wait for gallery to load
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (e) {
      console.log("Could not click gallery button:", e);
    }
  }

  // Get all image elements
  const imgElements = document.querySelectorAll(
    'button > img, div[data-test-id="image-viewer"] img',
  );
  imgElements.forEach((img) => {
    const src = img.getAttribute("src");
    if (src && !photos.includes(fixPhotoUrl(src))) {
      photos.push(fixPhotoUrl(src));
    }
  });

  // Close the gallery if it was opened
  if (galleryButton) {
    try {
      const closeButton = document.querySelector(
        'button[data-spark-component="dialog-close-button"][aria-label="Fermer"]',
      ) as HTMLButtonElement;
      if (closeButton) {
        closeButton.click();
        console.log("Gallery closed");
      }
    } catch (e) {
      console.log("Could not close gallery:", e);
    }
  }

  return photos;
}

function getDescription(): string {
  // Try multiple selectors for description
  const selectors = [
    '[data-qa-id="adview_description_container"]',
    'div[data-test-id="description"]',
    "#readme-content",
  ];

  for (const selector of selectors) {
    const elem = document.querySelector(selector);
    if (elem) {
      // Check for "See more" button and click it
      const seeMoreButtons = Array.from(document.querySelectorAll("button"));
      const seeMoreButton = seeMoreButtons.find(
        (btn) =>
          btn.textContent?.includes("Voir plus") ||
          btn.textContent?.includes("See more"),
      );

      if (seeMoreButton) {
        try {
          seeMoreButton.click();
        } catch (e) {
          console.log("Could not click see more button:", e);
        }
      }

      return elem.textContent?.trim() || "";
    }
  }

  return "";
}

async function scrapeAdDetails() {
  if (detailsScraped) {
    console.log("Details already scraped for this page");
    return;
  }

  const adId = extractAdId();
  if (!adId) {
    console.warn("Could not extract ad ID from URL");
    return;
  }

  const username = extractUsernameFromAdPage();
  if (!username) {
    console.warn("Could not extract username from ad page");
    return;
  }

  // Check if this ad exists in the listings for this username
  const response = await browser.runtime.sendMessage({
    type: "CHECK_LISTING_EXISTS",
    username,
    adId,
  });

  if (!response || !response.exists) {
    console.log(
      `Ad ${adId} not found in listings for ${username}. Skipping detail scraping.`,
    );
    detailsScraped = true; // Mark as scraped to avoid re-checking
    return;
  }

  // Check if details already exist
  const detailsResponse = await browser.runtime.sendMessage({
    type: "CHECK_DETAILS_EXIST",
    username,
    adId,
  });

  if (detailsResponse && detailsResponse.exists) {
    console.log(`Details already exist for ad ${adId}. Skipping scraping.`);
    detailsScraped = true;
    return;
  }

  console.log(`Scraping details for ad ${adId} from seller ${username}`);

  try {
    const description = getDescription();
    const photos = await getPhotoUrls();

    const detail: ProductDetail = {
      id: adId,
      description,
      photos,
      scrapedAt: new Date().toISOString(),
    };

    console.log("Scraped details:", {
      description: description.substring(0, 100),
      photoCount: photos.length,
    });

    await saveProductDetails(username, detail);
    detailsScraped = true;

    showNotification(
      `Détails de l'annonce sauvegardés (${photos.length} photos)`,
    );
  } catch (error) {
    console.error("Error scraping ad details:", error);
  }
}
