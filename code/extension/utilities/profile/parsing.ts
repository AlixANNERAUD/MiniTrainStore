import { ProductListing, ProductState } from "../settings";
import { getProductIdentifierFromUrl } from "../product/location";
import {
  ARTICLES_SELECTOR,
  BADGE_SELECTOR,
  DATE_SELECTOR,
  IMAGE_SELECTOR,
  LINK_SELECTOR,
  PAGINATION_BUTTON_SELECTOR,
  PAGINATION_BUTTONS_SELECTOR,
  PRICE_SELECTOR,
  TITLE_SELECTOR,
} from "./selectors";

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

function getLastWeekdayDate(weekday: number): string {
  const today = new Date();
  const lastWeekday = new Date(today);
  lastWeekday.setDate(
    today.getDate() - ((today.getDay() + 7 - weekday) % 7 || 7),
  );
  return lastWeekday.toISOString();
}

function parseDate(dateStr: string): string {
  if (dateStr.toLocaleLowerCase().includes("aujourd’hui")) {
    return new Date().toISOString();
  } else if (dateStr.toLocaleLowerCase().includes("hier")) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString();
  } else if (dateStr.toLocaleLowerCase().includes("samedi dernier")) {
    return getLastWeekdayDate(6); // 6 represents Saturday
  } else if (dateStr.toLocaleLowerCase().includes("vendredi dernier")) {
    return getLastWeekdayDate(5); // 5 represents Friday
  } else if (dateStr.toLocaleLowerCase().includes("jeudi dernier")) {
    return getLastWeekdayDate(4); // 4 represents Thursday
  } else if (dateStr.toLocaleLowerCase().includes("mercredi dernier")) {
    return getLastWeekdayDate(3); // 3 represents Wednesday
  } else if (dateStr.toLocaleLowerCase().includes("mardi dernier")) {
    return getLastWeekdayDate(2); // 2 represents Tuesday
  } else if (dateStr.toLocaleLowerCase().includes("lundi dernier")) {
    return getLastWeekdayDate(1); // 1 represents Monday
  } else if (dateStr.toLocaleLowerCase().includes("dimanche dernier")) {
    return getLastWeekdayDate(0); // 0 represents Sunday
  } else {
    // Should be in 02/01/2023 format, try parsing it
    const parts = dateStr.split("/").map((part) => parseInt(part, 10));
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }

  // If all parsing fails, return current date as fallback
  return new Date().toISOString();
}

export function parseProduct(article: Element): {
  identifier: string;
  product: ProductListing;
} | null {
  try {
    // Get the URL first to extract ID
    const linkElem = article.querySelector(LINK_SELECTOR) as HTMLAnchorElement;
    const relativeUrl = linkElem?.getAttribute("href") || "";
    const fullUrl = relativeUrl
      ? `https://www.leboncoin.fr${relativeUrl}`
      : "N/A";

    const identifier = getProductIdentifierFromUrl(new URL(fullUrl));

    if (!identifier) {
      throw new Error("Could not extract product identifier from URL");
    }

    // Get the title
    const titleElem = article.querySelector(TITLE_SELECTOR);
    const title = titleElem?.textContent?.trim() || "N/A";

    // Get the price
    const priceElem = article.querySelector(PRICE_SELECTOR);
    const priceText = priceElem?.textContent?.trim() || "0";
    const price = parseFloat(priceText.replace(/[^\d]/g, ""));

    // Get the thumbnail image
    const thumbnailElem = article.querySelector(
      IMAGE_SELECTOR,
    ) as HTMLImageElement;
    const thumbnail = thumbnailElem?.getAttribute("src") || "";

    // Check if the product is sold
    let state = ProductState.ACTIVE;
    const badge = article.querySelector(BADGE_SELECTOR);
    if (badge && badge.textContent?.trim() === "Vendu") {
      state = ProductState.PURCHASE_COMPLETED;
    } else if (badge && badge.textContent?.trim() === "Achat en cours") {
      state = ProductState.PURCHASE_PENDING;
    }

    // Get the date
    let datePosted = "N/A";
    try {
      const dateElem = article.querySelector(DATE_SELECTOR);
      if (dateElem) {
        datePosted = dateElem.textContent?.trim() || "N/A";
      }
    } catch (e) {
      console.error("Error parsing date:", e);
    }

    console.log(
      `Parsed product - ID: ${identifier}, Title: ${title}, Price: ${price}, Date: ${datePosted}, State: ${state}`,
    );

    // Parse the date string using chrono-node
    const date = parseDate(datePosted);

    console.log(`Parsed ${datePosted} into ISO date: ${date}`);

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

export function parseProfilePage(): {
  username: string;
  products: Record<string, ProductListing>;
} {
  const profileName = parseProfileName() || "Unknown Seller";

  const articles = document.querySelectorAll(ARTICLES_SELECTOR);
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
    document.querySelectorAll(PAGINATION_BUTTONS_SELECTOR),
  ) as HTMLButtonElement[];
}

export function getProfilePaginationButton(
  pageNum: number,
): HTMLButtonElement | null {
  return document.querySelector(
    PAGINATION_BUTTON_SELECTOR(pageNum),
  ) as HTMLButtonElement | null;
}
