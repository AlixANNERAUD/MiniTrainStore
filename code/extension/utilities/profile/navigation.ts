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

export async function scrapeProfileCurrentPage(
  settings: ReturnType<typeof useSettingsStore>,
  userIdentifier: string,
) {
  if (!settings.isProfileAdded(userIdentifier)) {
    console.log("Profile not added, skipping auto-scrape");
    return;
  }

  console.log(`Auto-scraping profile: ${userIdentifier}`);

  const profileData = parseProfilePage();

  if (profileData.products && Object.keys(profileData.products).length > 0) {
    const stats = await settings.updateProductListing(
      userIdentifier,
      profileData.products,
      true,
    );
    console.log(
      `✓ Saved products for ${profileData.username}: ${stats.added} added, ${stats.updated} updated`,
    );
    // if (stats.added > 0 || stats.updated > 0) {
    //   showNotification(
    //     `${stats.updated} mis à jour / ${stats.added} ajouté${stats.added > 1 ? "s" : ""}`,
    //   );
    // }
  }
}

export async function scrapeProfileAllPages() {
  const settings = useSettingsStore();

  const allProducts: Record<string, ProductListing> = {};

  const pageButtons = getProfilePaginationButtons();
  const totalPages = pageButtons.length;

  console.log(`Found ${totalPages} pages to scrape`);

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    // Navigate to next page if not the last one
    const nextPageButton = getProfilePaginationButton(pageNum);
    if (nextPageButton && !nextPageButton.disabled) {
      nextPageButton.click();
      // Wait for page to load
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } else {
      console.log("No next page button found or disabled");
      break;
    }

    // Scrape current page
    const { products } = parseProfilePage();

    // Merge into allProducts
    Object.entries(products).forEach(([id, product]) => {
      allProducts[id] = product;
    });

    console.log(
      `Scraped page ${pageNum}/${totalPages}: ${Object.keys(products).length} products`,
    );
  }

  settings.updateProductListing(
    settings.selectedProfile.value!,
    allProducts,
    true,
  );
}
