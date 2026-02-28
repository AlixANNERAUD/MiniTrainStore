import { ProductDetail } from "../settings";
import { getProductIdentifierFromUrl } from "./location";
import { extractUsernameFromProductPage } from "./parsing";

async function waitForProductPageLoad(): Promise<void> {
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

export async function scrapeProductDetails(): Promise<ProductDetail> {
  const productIdentifier = getProductIdentifierFromUrl(
    new URL(window.location.href),
  );

  if (!productIdentifier) {
    throw new Error("Could not extract ad ID from URL");
  }

  const username = extractUsernameFromProductPage();
  if (!username) {
    console.log(
      "Could not extract username from ad page. Skipping detail scraping.",
    );
  }

  // Check if this ad exists in the listings for this username
  const response = await browser.runtime.sendMessage({
    type: "CHECK_LISTING_EXISTS",
    username,
    adId: productIdentifier,
  });

  if (!response || !response.exists) {
    console.log(
      `Ad ${productIdentifier} not found in listings for ${username}. Skipping detail scraping.`,
    );
    detailsScraped = true; // Mark as scraped to avoid re-checking
    return;
  }

  // Check if details already exist
  const detailsResponse = await browser.runtime.sendMessage({
    type: "CHECK_DETAILS_EXIST",
    username,
    adId: productIdentifier,
  });

  if (detailsResponse && detailsResponse.exists) {
    console.log(
      `Details already exist for ad ${productIdentifier}. Skipping scraping.`,
    );
    detailsScraped = true;
    return;
  }

  console.log(
    `Scraping details for ad ${productIdentifier} from seller ${username}`,
  );

  try {
    const description = getDescription();
    const photos = await getPhotoUrls();

    const detail: ProductDetail = {
      id: productIdentifier,
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
