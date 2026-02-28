import { ProductListing, ProductState } from "../settings";
import { getProductIdentifierFromUrl } from "../product/location";

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

export function getDescription(): string {
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

    console.log(
      "Parsing product with URL:",
      fullUrl,
      "Extracted ID:",
      identifier,
    );

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
      identifier,
      product: {
        title,
        price,
        url: fullUrl,
        datePosted,
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
      products[product.identifier] = product;
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
