import { useSettingsStore } from "@/stores/settings";
import { ProductListing } from "@/utilities/settings";
import {
  getProfilePaginationButton,
  getProfilePaginationButtons,
  parseProfilePage,
} from "@/utilities/profile/parsing";

export async function waitForProfilePageLoad(): Promise<void> {
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

export async function scrapeCurrentProfilePage(
  userIdentifier: string,
): Promise<Record<string, ProductListing>> {
  const products = parseProfilePage();

  if (Object.keys(products).length > 0) {
    await settings.updateProductListing(userIdentifier, products, true);
  }

  return products;
}

export async function scrapeAllProfilePages(
  username: string,
  onProgress?: (current: number, total: number) => void,
): Promise<Record<string, ProductListing>> {
  const allProducts: Record<string, ProductListing> = {};
  const scrapedIdsSet = new Set<string>();

  const pageButtons = getProfilePaginationButtons();
  const totalPages = pageButtons.length;

  console.log(`Found ${totalPages} pages to scrape`);

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.(pageNum, totalPages);

    // Scrape current page
    const products = parseProfilePage();

    // Merge into allProducts
    Object.entries(products).forEach(([id, product]) => {
      allProducts[id] = product;
      scrapedIdsSet.add(id);
    });

    console.log(
      `Scraped page ${pageNum}/${totalPages}: ${Object.keys(products).length} products`,
    );

    // Navigate to next page if not the last one
    if (pageNum < totalPages) {
      const nextPageButton = getProfilePaginationButton(pageNum + 1);
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

  return allProducts;
}
