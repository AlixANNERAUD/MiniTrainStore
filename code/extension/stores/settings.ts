import {
  CombinedProduct,
  DEFAULT_SETTINGS,
  ProductDetail,
  ProductListing,
  ProductState,
  ProductUpdateStatistics,
  ProfileData,
  SettingsData,
} from "@/utilities/settings";
import { defineWxtStore } from "@/utilities/wxt-store";

export const SETTINGS_KEY = "miniTrainStoreSettings";

export const useSettingsStore = defineWxtStore(SETTINGS_KEY, {
  state: () => DEFAULT_SETTINGS,
  actions: (state) => ({
    reset() {
      state.categories = DEFAULT_SETTINGS.categories;
      state.tags = DEFAULT_SETTINGS.tags;
      state.odoo = DEFAULT_SETTINGS.odoo;
      state.profiles = DEFAULT_SETTINGS.profiles;
      state.selectedProfile = DEFAULT_SETTINGS.selectedProfile;
      state.selectedFilter = DEFAULT_SETTINGS.selectedFilter;
      state.selectedOrderBy = DEFAULT_SETTINGS.selectedOrderBy;
      state.currentTab = DEFAULT_SETTINGS.currentTab;
    },
    addProfile(userIdentifier: string, displayName: string) {
      state.profiles[userIdentifier] = {
        displayName,
        listings: {},
        details: {},
        lastScraped: new Date().toISOString(),
      };
    },
    isProfileAdded(userIdentifier: string): boolean {
      return !!state.profiles[userIdentifier];
    },
    getProduct(productIdentifier: string): CombinedProduct | null {
      for (const profile of Object.values(state.profiles)) {
        if (profile.listings[productIdentifier]) {
          return {
            identifier: productIdentifier,
            listing: profile.listings[productIdentifier],
            detail: profile.details[productIdentifier],
          };
        }
      }
      return null;
    },
    updateProductListing(
      userIdentifier: string,
      listing: Record<string, ProductListing>,
      markMissingAsRemoved = false,
    ): ProductUpdateStatistics {
      if (!state.profiles[userIdentifier]) {
        return {
          added: 0,
          updated: 0,
          removed: 0,
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
    updateProductDetail(productIdentifier: string, detail: ProductDetail) {
      Object.values(state.profiles).forEach((profile) => {
        if (profile.listings[productIdentifier]) {
          profile.details[productIdentifier] = detail;
        }
      });
    },
    getProfileIdentifiers(): string[] {
      return Object.keys(state.profiles);
    },
    getProfile(identifier: string): ProfileData | null {
      return state.profiles[identifier] || null;
    },
    getCombinedProducts(userIdentifier: string): CombinedProduct[] {
      const profile = state.profiles[userIdentifier];
      if (!profile) {
        return [];
      }

      const combined: CombinedProduct[] = Object.keys(profile.listings).map(
        (id) => ({
          identifier: id,
          listing: profile.listings[id],
          detail: profile.details[id],
        }),
      );

      return combined;
    },
    clearProfileData(userIdentifier: string) {
      if (state.profiles[userIdentifier]) {
        state.profiles[userIdentifier].listings = {};
        state.profiles[userIdentifier].details = {};
        state.profiles[userIdentifier].lastScraped = new Date().toISOString();
      }
    },
    export(): SettingsData {
      return state;
    },
  }),
});
