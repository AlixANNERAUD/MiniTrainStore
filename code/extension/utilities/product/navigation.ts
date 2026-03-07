import { useSettingsStore } from "@/stores/settings";
import { getProductIdentifierFromUrl } from "./location";
import { parseProductDetails } from "./parsing";

export async function waitForProductPageLoad(): Promise<void> {
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

export async function scrapeProductDetails() {
  const settings = useSettingsStore();

  const productIdentifier = getProductIdentifierFromUrl(
    new URL(window.location.href),
  );

  if (!productIdentifier) {
    throw new Error("Could not extract ad ID from URL");
  }

  const product = settings.getProduct(productIdentifier);

  // Check if product exists without details
  if (!product || product.detail) {
    console.log(
      `Product ${productIdentifier} already has details or does not exist. Skipping scraping.`,
    );
    return;
  }

  try {
    const detail = await parseProductDetails();

    console.log("Scraped details:", {
      description: detail.description.substring(0, 100),
      photoCount: detail.photos.length,
    });

    settings.updateProductDetail(productIdentifier, detail);

    return detail;
  } catch (error) {
    console.error("Error scraping ad details:", error);
    return null;
  }
}
