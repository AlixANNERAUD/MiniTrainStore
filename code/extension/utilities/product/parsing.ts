import { ProductListing } from "../settings";

export function extractUsernameFromProductPage(): string | null {
  // Try to find the seller profile link
  const PROFILE_LINK_SELECTOR = 'a[href^="/profile/"]';

  const profileLink = document.querySelector(
    PROFILE_LINK_SELECTOR,
  ) as HTMLAnchorElement;

  if (!profileLink) return null;

  const match = profileLink.getAttribute("href")?.match(/^\/profile\/([^\/]+)/);
  return match ? match[1] : null;
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
    const photoUrl = img.getAttribute("src");

    if (photoUrl && !photos.includes(photoUrl)) {
      photos.push(photoUrl);
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
