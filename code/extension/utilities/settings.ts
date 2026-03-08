export enum OrderBy {
  DATE = "date",
  PRICE = "price",
}

export enum ProductState {
  ACTIVE = "ACTIVE",
  PURCHASE_PENDING = "PURCHASE_PENDING",
  PURCHASE_COMPLETED = "PURCHASE_COMPLETED",
  REMOVED = "REMOVED",
}

// Listing: Basic info scraped from profile pages
export interface ProductListing {
  title: string;
  price: number;
  url: string;
  date: string;
  state: ProductState;
  thumbnail: string; // Thumbnail image from listing card
  scrapedAt: string; // ISO date string - when this listing was scraped
}

// Detail: Additional info fetched from individual ad pages
export interface ProductDetail {
  description: string;
  photos: string[];
  scrapedAt: string; // ISO date string - when details were fetched
}

// Combined view for convenience
export interface CombinedProduct {
  identifier: string;
  listing: ProductListing;
  detail?: ProductDetail;
}

export interface ProductUpdateStatistics {
  added: number;
  updated: number;
  removed: number;
}

export interface ProfileData {
  displayName?: string; // Display name from profile page
  listings: Record<string, ProductListing>; // keyed by product ID
  details: Record<string, ProductDetail>; // keyed by product ID
  lastScraped: string; // ISO date string
}

export interface OdooSettings {
  url: string;
  apiKey: string;
}

export interface TagSettings {
  pattern: string;
  tag: string;
}

export interface CategorySettings {
  pattern: string;
  category: string;
}

export interface SettingsData {
  odoo: OdooSettings;
  profiles: Record<string, ProfileData>;
  tags: TagSettings[];
  categories: CategorySettings[];
  selectedProfile: string | null;
  selectedFilter: ProductState | "ALL";
  selectedOrderBy: OrderBy;
  searchQuery: string;
  currentTab: 0;
}

// Updated DEFAULT_SETTINGS to include regex-based tags
export const DEFAULT_SETTINGS: SettingsData = {
  odoo: {
    url: "",
    apiKey: "",
  },
  profiles: {},
  tags: [
    { pattern: "\\bjouef\\b", tag: "Jouef" },
    { pattern: "\\blima\\b", tag: "Lima" },
    { pattern: "\\bhornby\\b", tag: "Hornby" },
    { pattern: "\\broco\\b", tag: "Roco" },
    { pattern: "\\bpiko\\b", tag: "Piko" },
    { pattern: "\\bmarklin\\b|\\bmärklin\\b", tag: "Märklin" },
    { pattern: "\\bfleischmann\\b", tag: "Fleischmann" },
    { pattern: "\\bho\\b", tag: "H0" },
    { pattern: "\\bsncf\\b", tag: "SNCF" },
  ],
  categories: [
    {
      pattern:
        "\\bwgon\\b|\\bwagon\\b|\\bwagons\\b|\\bvoiture\\b|\\bvoitures\\b|\\bfourgon\\b|\\ballège\\b|\\bremorque\\b",
      category: "Wagons",
    },
    {
      pattern:
        "\\blocomotive\\b|\\blocomotives\\b|\\blocotracteur\\b|\\blocotender\\b|\\bautorail\\b|motrice\\b",
      category: "Locomotives",
    },
    {
      pattern:
        "\\btrails\\b|\\brail\\b|\\baiguillage\\b|\\bvoie\\b|\\brails\\b|\\baiguillages\\b|\\bvoies\\b|\\bcroisement\\b|\\bjonction\\b|\\btjd\\b|\\bheurtoir\\b|\\bheurtoirs\\b",
      category: "Rails",
    },
    {
      pattern:
        "\\bpersonnages\\b|\\bpersonnage\\b|\\btunnel\\b|\\bconteneurs\\b|\\bbureau\\b",
      category: "Décor",
    },
    { pattern: "\\bcoffret\\b|\\bcoffrets\\b", category: "Coffrets" },
  ],
  selectedProfile: null,
  selectedFilter: "ALL",
  selectedOrderBy: OrderBy.DATE,
  searchQuery: "",
  currentTab: 0,
};
