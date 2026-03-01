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

// Odoo export metadata
export interface OdooExportStatus {
  exported: boolean;
  odooProductId?: number;
  lastExportedAt?: string; // ISO date string
  exportError?: string;
}

// Combined view for convenience
export interface CombinedProduct {
  identifier: string;
  listing: ProductListing;
  detail?: ProductDetail;
  odooExport?: OdooExportStatus;
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
  odooExports: Record<string, OdooExportStatus>; // keyed by product ID
  lastScraped: string; // ISO date string
}

export interface OdooSettings {
  url: string;
  apiKey: string;
}

export interface SettingsData {
  odoo: OdooSettings;
  profiles: Record<string, ProfileData>;
  selectedProfile: string | null;
  selectedFilter: ProductState | "ALL";
  selectedOrderBy: OrderBy;
  currentTab: 0;
}

export const DEFAULT_SETTINGS: SettingsData = {
  odoo: {
    url: "",
    apiKey: "",
  },
  profiles: {},
  selectedProfile: null,
  selectedFilter: "ALL",
  selectedOrderBy: OrderBy.DATE,
  currentTab: 0,
};
