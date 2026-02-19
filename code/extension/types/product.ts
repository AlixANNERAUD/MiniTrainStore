export enum ProductState {
  ACTIVE = "ACTIVE",
  SOLD = "SOLD",
  REMOVED = "REMOVED",
}

// Listing: Basic info scraped from profile pages
export interface ProductListing {
  id: string; // Extracted from URL
  title: string;
  price: number;
  url: string;
  datePosted: string;
  date: string; // ISO date string
  state: ProductState;
  thumbnail?: string; // Thumbnail image from listing card
}

// Detail: Additional info fetched from individual ad pages
export interface ProductDetail {
  id: string;
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
export interface Product extends ProductListing {
  description?: string;
  photos?: string[];
  detailsScrapedAt?: string;
  odooExport?: OdooExportStatus;
}

export interface ProfileData {
  username: string;
  profileName?: string; // Display name from profile page
  listings: Record<string, ProductListing>; // keyed by product ID
  details: Record<string, ProductDetail>; // keyed by product ID
  odooExports?: Record<string, OdooExportStatus>; // keyed by product ID
  lastScraped: string; // ISO date string
}

export interface StorageData {
  profiles: Record<string, ProfileData>; // keyed by username
}
