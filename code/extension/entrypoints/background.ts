import {
  ProductListing,
  ProductDetail,
  ProfileData,
  Product,
  ProductState,
  OdooExportStatus,
} from "@/types/product";
import { createOdooService, OdooConfig } from "@/services/odoo";

export default defineBackground(() => {
  console.log("Background script started", { id: browser.runtime.id });

  // Listen for messages from content script
  browser.runtime.onMessage.addListener(
    (message: any, sender: any, sendResponse: any) => {
      if (message.type === "SAVE_PRODUCTS") {
        handleSaveProducts(
          message.username,
          message.products,
          message.profileName,
        ).then((stats) => {
          sendResponse({ success: true, ...stats });
        });
        return true; // Will respond asynchronously
      } else if (message.type === "SAVE_PRODUCT_DETAILS") {
        handleSaveProductDetails(message.username, message.detail).then(() => {
          sendResponse({ success: true });
        });
        return true; // Will respond asynchronously
      } else if (message.type === "CHECK_LISTING_EXISTS") {
        checkListingExists(message.username, message.adId).then(sendResponse);
        return true; // Will respond asynchronously
      } else if (message.type === "CHECK_DETAILS_EXIST") {
        checkDetailsExist(message.username, message.adId).then(sendResponse);
        return true; // Will respond asynchronously
      } else if (message.type === "MARK_MISSING_AS_REMOVED") {
        markMissingAsRemoved(message.username, message.currentIds).then(() => {
          sendResponse({ success: true });
        });
        return true; // Will respond asynchronously
      } else if (message.type === "GET_PROFILES") {
        getProfiles().then(sendResponse);
        return true; // Will respond asynchronously
      } else if (message.type === "GET_PROFILE") {
        getProfile(message.username).then(sendResponse);
        return true; // Will respond asynchronously
      } else if (message.type === "GET_COMBINED_PRODUCTS") {
        getCombinedProducts(message.username).then(sendResponse);
        return true; // Will respond asynchronously
      } else if (message.type === "EXPORT_TO_ODOO") {
        exportToOdoo(
          message.odooUrl,
          message.odooApiKey,
          message.odooApiPath,
          message.username,
          message.products,
          message.productIds,
        ).then(sendResponse);
        return true; // Will respond asynchronously
      } else if (message.type === "EXPORT_SINGLE_TO_ODOO") {
        exportSingleToOdoo(
          message.odooUrl,
          message.odooApiKey,
          message.odooApiPath,
          message.username,
          message.product,
        ).then(sendResponse);
        return true; // Will respond asynchronously
      }
    },
  );
});

async function handleSaveProducts(
  username: string,
  newProducts: ProductListing[],
  profileName?: string,
): Promise<{ added: number; updated: number }> {
  try {
    // Get existing profiles from storage
    const profiles =
      (await storage.getItem<Record<string, ProfileData>>("local:profiles")) ||
      {};
    console.log("Current storage:", profiles);

    // Get existing profile data or create new
    const existingProfile = profiles[username];
    const existingListings = existingProfile?.listings || {};
    const existingDetails = existingProfile?.details || {};

    // Merge listings and track changes
    const { merged, added, updated } = mergeListingsWithStats(
      existingListings,
      newProducts,
    );

    // Update profile data
    profiles[username] = {
      username,
      profileName: profileName || existingProfile?.profileName, // Use new name or keep existing
      listings: merged,
      details: existingDetails, // keep existing details
      lastScraped: new Date().toISOString(),
    };

    console.log("Saving profile:", profiles[username]);

    // Save back to storage
    await storage.setItem("local:profiles", profiles);

    const totalCount = Object.keys(merged).length;
    console.log(
      `Saved ${totalCount} total listings for ${username} (${added} added, ${updated} updated)`,
    );

    // Verify it was saved
    const verify = await storage.getItem("local:profiles");
    console.log("Verification - profiles in storage:", verify);

    return { added, updated };
  } catch (error) {
    console.error("Error saving products:", error);
    return { added: 0, updated: 0 };
  }
}

async function handleSaveProductDetails(
  username: string,
  detail: ProductDetail,
) {
  try {
    // Get existing profiles from storage
    const profiles =
      (await storage.getItem<Record<string, ProfileData>>("local:profiles")) ||
      {};

    // Get existing profile data or create new
    const existingProfile = profiles[username];
    const existingListings = existingProfile?.listings || {};
    const existingDetails = existingProfile?.details || {};

    // Add or update the detail
    existingDetails[detail.id] = detail;

    // Update profile data
    profiles[username] = {
      username,
      profileName: existingProfile?.profileName, // Preserve existing profile name
      listings: existingListings,
      details: existingDetails,
      lastScraped: existingProfile?.lastScraped || new Date().toISOString(),
    };

    console.log(
      `Saved details for product ${detail.id} (${detail.photos.length} photos)`,
    );

    // Save back to storage
    await storage.setItem("local:profiles", profiles);
  } catch (error) {
    console.error("Error saving product details:", error);
  }
}

async function getProfiles(): Promise<ProfileData[]> {
  try {
    const profiles =
      (await storage.getItem<Record<string, ProfileData>>("local:profiles")) ||
      {};
    return Object.values(profiles);
  } catch (error) {
    console.error("Error getting profiles:", error);
    return [];
  }
}

async function getProfile(username: string): Promise<ProfileData | null> {
  try {
    const profiles =
      (await storage.getItem<Record<string, ProfileData>>("local:profiles")) ||
      {};
    return profiles[username] || null;
  } catch (error) {
    console.error("Error getting profile:", error);
    return null;
  }
}

async function getCombinedProducts(username: string): Promise<Product[]> {
  try {
    const profile = await getProfile(username);
    if (!profile) return [];

    return combineListingsWithDetails(
      profile.listings,
      profile.details,
      profile.odooExports,
    );
  } catch (error) {
    console.error("Error getting combined products:", error);
    return [];
  }
}

async function checkListingExists(
  username: string,
  adId: string,
): Promise<{ exists: boolean }> {
  try {
    const profiles =
      (await storage.getItem<Record<string, ProfileData>>("local:profiles")) ||
      {};
    const profile = profiles[username];

    if (!profile || !profile.listings) {
      return { exists: false };
    }

    const exists = adId in profile.listings;
    console.log(`Checking if ad ${adId} exists for ${username}: ${exists}`);

    return { exists };
  } catch (error) {
    console.error("Error checking if listing exists:", error);
    return { exists: false };
  }
}

async function checkDetailsExist(
  username: string,
  adId: string,
): Promise<{ exists: boolean }> {
  try {
    const profiles =
      (await storage.getItem<Record<string, ProfileData>>("local:profiles")) ||
      {};
    const profile = profiles[username];

    if (!profile || !profile.details) {
      return { exists: false };
    }

    const exists = adId in profile.details;
    console.log(`Checking if details exist for ad ${adId}: ${exists}`);

    return { exists };
  } catch (error) {
    console.error("Error checking if details exist:", error);
    return { exists: false };
  }
}

async function markMissingAsRemoved(username: string, currentIds: string[]) {
  try {
    const profiles =
      (await storage.getItem<Record<string, ProfileData>>("local:profiles")) ||
      {};
    const profile = profiles[username];

    if (!profile || !profile.listings) {
      console.log("No profile or listings found");
      return;
    }

    const currentIdsSet = new Set(currentIds);
    let removedCount = 0;

    // Mark products as REMOVED if they're not in currentIds
    for (const [id, listing] of Object.entries(profile.listings)) {
      if (!currentIdsSet.has(id) && listing.state !== ProductState.REMOVED) {
        profile.listings[id] = {
          ...listing,
          state: ProductState.REMOVED,
        };
        removedCount++;
      }
    }

    if (removedCount > 0) {
      profiles[username] = profile;
      await storage.setItem("local:profiles", profiles);
      console.log(`Marked ${removedCount} products as REMOVED for ${username}`);
    }
  } catch (error) {
    console.error("Error marking missing products as removed:", error);
  }
}

function mergeListingsWithStats(
  existing: Record<string, ProductListing>,
  newListings: ProductListing[],
): { merged: Record<string, ProductListing>; added: number; updated: number } {
  const merged = { ...existing };
  let added = 0;
  let updated = 0;

  // Add or update with new listings
  newListings.forEach((listing) => {
    const existingListing = merged[listing.id];
    if (existingListing) {
      // Check if data actually changed
      const hasChanged =
        existingListing.title !== listing.title ||
        existingListing.price !== listing.price ||
        existingListing.state !== listing.state ||
        existingListing.datePosted !== listing.datePosted ||
        existingListing.url !== listing.url ||
        existingListing.thumbnail !== listing.thumbnail;

      if (hasChanged) {
        // Update existing listing with new data
        merged[listing.id] = {
          ...existingListing,
          ...listing,
        };
        updated++;
      }
      // If no changes, don't count it
    } else {
      merged[listing.id] = listing;
      added++;
    }
  });

  return { merged, added, updated };
}

function combineListingsWithDetails(
  listings: Record<string, ProductListing>,
  details: Record<string, ProductDetail>,
  odooExports?: Record<string, OdooExportStatus>,
): Product[] {
  const combined: Product[] = [];

  for (const [id, listing] of Object.entries(listings)) {
    const detail = details[id];
    const odooExport = odooExports?.[id];
    combined.push({
      ...listing,
      description: detail?.description,
      photos: detail?.photos,
      detailsScrapedAt: detail?.scrapedAt,
      odooExport,
    });
  }

  return combined;
}

async function exportSingleToOdoo(
  odooUrl: string,
  odooApiKey: string,
  odooApiPath: string,
  username: string,
  product: Product,
): Promise<{
  success: boolean;
  created?: boolean;
  updated?: boolean;
  archived?: boolean;
  error?: string;
}> {
  try {
    console.log(`Exporting product to Odoo: ${product.title}`);

    const config: OdooConfig = {
      url: odooUrl,
      apiKey: odooApiKey,
      apiPath: odooApiPath,
    };
    const odooService = createOdooService(config);

    // Strip "Train wagon" from title if present
    const cleanedProduct = {
      ...product,
      title: product.title.replace(/Train wagon/gi, "").trim(),
    };

    const result = await odooService.exportProduct(cleanedProduct, true);

    // Save export status to storage
    const profiles =
      (await storage.getItem<Record<string, ProfileData>>("local:profiles")) ||
      {};
    const profile = profiles[username];

    if (profile) {
      if (!profile.odooExports) {
        profile.odooExports = {};
      }

      profile.odooExports[product.id] = {
        exported: result.success,
        odooProductId: result.productId,
        lastExportedAt: new Date().toISOString(),
        exportError: result.error,
      };

      profiles[username] = profile;
      await storage.setItem("local:profiles", profiles);
    }

    return {
      success: result.success,
      created: result.created,
      updated: result.updated,
      archived: result.archived,
      error: result.error,
    };
  } catch (error) {
    console.error("Odoo export error:", error);
    return { success: false, error: String(error) };
  }
}

async function exportToOdoo(
  odooUrl: string,
  odooApiKey: string,
  odooApiPath: string,
  username: string,
  products: Product[],
  productIds?: string[],
): Promise<{
  success: boolean;
  created?: number;
  updated?: number;
  archived?: number;
  errors?: any[];
  error?: string;
}> {
  try {
    console.log(`Exporting ${products.length} products to Odoo at ${odooUrl}`);

    const config: OdooConfig = {
      url: odooUrl,
      apiKey: odooApiKey,
      apiPath: odooApiPath,
    };
    const odooService = createOdooService(config);

    // Strip "Train wagon" from titles
    const cleanedProducts = products.map((p) => ({
      ...p,
      title: p.title.replace(/Train wagon/gi, "").trim(),
    }));

    const result = await odooService.exportProducts(cleanedProducts, true);

    // Save export statuses to storage
    const profiles =
      (await storage.getItem<Record<string, ProfileData>>("local:profiles")) ||
      {};
    const profile = profiles[username];

    if (profile) {
      if (!profile.odooExports) {
        profile.odooExports = {};
      }

      // Update export status for all products
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const productId = productIds?.[i] || product.id;

        // Find the result for this specific product
        const errorForProduct = result.errors.find(
          (e) => e.productId === product.id,
        );

        profile.odooExports[productId] = {
          exported: !errorForProduct,
          lastExportedAt: new Date().toISOString(),
          exportError: errorForProduct?.error,
        };
      }

      profiles[username] = profile;
      await storage.setItem("local:profiles", profiles);
    }

    return {
      success: result.success,
      created: result.created,
      updated: result.updated,
      archived: result.archived,
      errors: result.errors,
    };
  } catch (error) {
    console.error("Odoo export error:", error);
    return { success: false, error: String(error) };
  }
}
