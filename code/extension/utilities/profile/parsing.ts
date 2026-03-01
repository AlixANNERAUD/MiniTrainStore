import { ProductListing, ProductState } from "../settings";
import { getProductIdentifierFromUrl } from "../product/location";
import * as chrono from "chrono-node";

export function parseProfileName(): string | null {
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

export function parseProduct(article: Element): {
  identifier: string;
  product: ProductListing;
} | null {
  try {
    // Get the URL first to extract ID
    const linkElem = article.querySelector(
      'a[href^="/ad/"]',
    ) as HTMLAnchorElement;
    const relativeUrl = linkElem?.getAttribute("href") || "";
    const fullUrl = relativeUrl
      ? `https://www.leboncoin.fr${relativeUrl}`
      : "N/A";

    const identifier = getProductIdentifierFromUrl(new URL(fullUrl));

    if (!identifier) {
      throw new Error("Could not extract product identifier from URL");
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
    const thumbnail = thumbnailElem?.getAttribute("src") || "";

    // Check if the product is sold
    let state = ProductState.ACTIVE;
    const badge = article.querySelector('div[data-spark-component="tag"]');
    if (badge && badge.textContent?.trim() === "Vendu") {
      state = ProductState.PURCHASE_COMPLETED;
    } else if (badge && badge.textContent?.trim() === "Achat en cours") {
      state = ProductState.PURCHASE_PENDING;
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

    // Parse the date string using chrono-node
    let date = new Date().toISOString();

    try {
      // Handle relative dates like "aujourd’hui", "hier", "jeudi dernier"
      const chronoOptions = {
        forwardDate: true,
      };
      const parsedDate = chrono.fr.parseDate(
        datePosted,
        new Date(),
        chronoOptions,
      );

      if (parsedDate) {
        date = parsedDate.toISOString();
      } else {
        console.warn(
          "Could not parse date string with chrono-node, using current date:",
          datePosted,
        );
        date = new Date().toISOString();
      }
    } catch (e) {
      console.error("Error parsing date string with chrono-node:", e);
      date = new Date().toISOString();
    }

    return {
      identifier,
      product: {
        title,
        price,
        url: fullUrl,
        date,
        state,
        thumbnail,
        scrapedAt: new Date().toISOString(),
      },
    };
  } catch (e) {
    console.error("Error parsing article:", e);
    return null;
  }
}

function fixPhotoUrl(url: string | null): string {
  if (!url) return "";
  // Convert thumbnail URLs to full-size
  return url.replace(/ad-thumb/g, "ad-large").replace(/ad-small/g, "ad-large");
}

export function parseProfilePage(): {
  username: string;
  products: Record<string, ProductListing>;
} {
  const profileName = parseProfileName() || "Unknown Seller";

  const articles = document.querySelectorAll('article[data-test-id="ad"]');
  console.log(`Found ${articles.length} articles on current page`);

  const products: Record<string, ProductListing> = {};
  articles.forEach((article) => {
    const product = parseProduct(article);
    if (product) {
      products[product.identifier] = product.product;
    }
  });

  return { username: profileName, products };
}

export function getProfilePaginationButtons(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll('button[data-test-id="page-button"]'),
  ) as HTMLButtonElement[];
}

export function getProfilePaginationButton(
  pageNum: number,
): HTMLButtonElement | null {
  return document.querySelector(
    `button[data-test-id="page-button"][title="Page ${pageNum}"]`,
  ) as HTMLButtonElement | null;
}
