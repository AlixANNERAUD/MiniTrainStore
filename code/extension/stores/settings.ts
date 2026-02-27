import {
  CombinedProduct,
  OdooExportStatus,
  ProductDetail,
  ProductListing,
  ProductState,
  ProductUpdateStatistics,
  ProfileData,
} from "@/utilities/product";
import { defineWxtStore } from "@/utilities/wxt-store";

export const SETTINGS_KEY = "miniTrainStoreSettings";

export interface SettingsData {
  profiles: Record<string, ProfileData>;
}

const defaultSettings: SettingsData = {
  profiles: {},
};

export const useSettingsStore = defineWxtStore(SETTINGS_KEY, {
  state: () => defaultSettings,
  actions: (state) => ({
    updateProductListing(
      userIdentifier: string,
      displayName: string,
      listing: Record<string, ProductListing>,
      markMissingAsRemoved = false,
    ): ProductUpdateStatistics {
      if (!state.profiles[userIdentifier]) {
        state.profiles[userIdentifier] = {
          displayName: displayName,
          listings: {},
          details: {},
          odooExports: {},
          lastScraped: new Date().toISOString(),
        };
      }

      const existingIdentifier = new Set(
        Object.keys(state.profiles[userIdentifier].listings),
      );
      const newIdentifiers = new Set(Object.keys(listing));

      const added = newIdentifiers.difference(existingIdentifier);
      const updated = newIdentifiers.intersection(existingIdentifier);
      const removed = existingIdentifier.difference(newIdentifiers);
      const profile = state.profiles[userIdentifier];

      added.forEach((id) => {
        profile.listings[id] = listing[id];
      });

      updated.forEach((id) => {
        profile.listings[id] = listing[id];
      });

      if (markMissingAsRemoved) {
        removed.forEach((id) => {
          if (profile.listings[id]) {
            profile.listings[id].state = ProductState.REMOVED;
          }
        });
      }

      profile.lastScraped = new Date().toISOString();

      return {
        added: added.size,
        updated: updated.size,
        removed: markMissingAsRemoved ? removed.size : 0,
      };
    },
    updateProductDetail(
      userIdentifier: string,
      productIdentifier: string,
      detail: ProductDetail,
    ) {
      state.profiles[userIdentifier].details[productIdentifier] = detail;
    },
    getProfileIdentifiers(): string[] {
      return Object.keys(state.profiles);
    },
    getProfile(identifier: string): ProfileData | null {
      return state.profiles[identifier] || null;
    },
    getCombinedProducts(
      username: string,

      filters?: {
        state?: ProductState;
      },
      orderBy?: "date" | "price",
    ): CombinedProduct[] {
      const profile = state.profiles[username];
      if (!profile) {
        return [];
      }

      const combined: CombinedProduct[] = Object.keys(profile.listings).map(
        (id) => ({
          identifier: id,
          listing: profile.listings[id],
          detail: profile.details[id],
          odooExport: profile.odooExports ? profile.odooExports[id] : undefined,
        }),
      );

      const filtered = combined.filter((p) => {
        if (filters?.state && p.listing.state !== filters.state) {
          return false;
        }
        return true;
      });

      if (orderBy === "date") {
        filtered.sort((a, b) => {
          const dateA = new Date(a.listing.datePosted).getTime();
          const dateB = new Date(b.listing.datePosted).getTime();
          return dateB - dateA; // Newest first
        });
      } else if (orderBy === "price") {
        filtered.sort((a, b) => a.listing.price - b.listing.price); // Lowest price first
      }

      return combined;
    },
    clearProfileData(userIdentifier: string) {
      if (state.profiles[userIdentifier]) {
        state.profiles[userIdentifier].listings = {};
        state.profiles[userIdentifier].details = {};
        state.profiles[userIdentifier].odooExports = {};
        state.profiles[userIdentifier].lastScraped = new Date().toISOString();
      }
    },
    export(): SettingsData {
      return state;
    },
  }),
});
