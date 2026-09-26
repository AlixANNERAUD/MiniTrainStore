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
  imageVerticalCropRatio: number;
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
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate and normalize a settings backup before applying it to the store. */
export function parseSettingsData(value: unknown): SettingsData {
  if (!isRecord(value)) {
    throw new Error(
      "Le fichier ne contient pas un objet de paramètres valide.",
    );
  }

  if (!isRecord(value.odoo) || !isRecord(value.profiles)) {
    throw new Error(
      "Le fichier ne contient pas la configuration Odoo ou les profils.",
    );
  }

  if (!Array.isArray(value.tags) || !Array.isArray(value.categories)) {
    throw new Error(
      "Le fichier ne contient pas les listes de tags ou de catégories.",
    );
  }

  const odoo = value.odoo;
  if (
    typeof odoo.url !== "string" ||
    typeof odoo.apiKey !== "string" ||
    (odoo.imageVerticalCropRatio !== undefined &&
      (typeof odoo.imageVerticalCropRatio !== "number" ||
        !Number.isFinite(odoo.imageVerticalCropRatio)))
  ) {
    throw new Error("La configuration Odoo du fichier est invalide.");
  }

  const profiles: Record<string, ProfileData> = {};
  for (const [identifier, rawProfile] of Object.entries(value.profiles)) {
    if (
      !isRecord(rawProfile) ||
      !isRecord(rawProfile.listings) ||
      !isRecord(rawProfile.details) ||
      (rawProfile.displayName !== undefined &&
        typeof rawProfile.displayName !== "string") ||
      (rawProfile.lastScraped !== undefined &&
        typeof rawProfile.lastScraped !== "string")
    ) {
      throw new Error(
        `Les données du profil « ${identifier} » sont invalides.`,
      );
    }

    profiles[identifier] = {
      displayName: rawProfile.displayName as string | undefined,
      listings: rawProfile.listings as ProfileData["listings"],
      details: rawProfile.details as ProfileData["details"],
      lastScraped: (rawProfile.lastScraped as string | undefined) ?? "",
    };
  }

  const tags = value.tags.map((tag) => {
    if (
      !isRecord(tag) ||
      typeof tag.pattern !== "string" ||
      typeof tag.tag !== "string"
    ) {
      throw new Error("La liste de tags du fichier est invalide.");
    }
    return { pattern: tag.pattern, tag: tag.tag };
  });

  const categories = value.categories.map((category) => {
    if (
      !isRecord(category) ||
      typeof category.pattern !== "string" ||
      typeof category.category !== "string"
    ) {
      throw new Error("La liste de catégories du fichier est invalide.");
    }
    return { pattern: category.pattern, category: category.category };
  });

  return {
    odoo: {
      ...DEFAULT_SETTINGS.odoo,
      url: odoo.url,
      apiKey: odoo.apiKey,
      ...(odoo.imageVerticalCropRatio !== undefined
        ? { imageVerticalCropRatio: odoo.imageVerticalCropRatio }
        : {}),
    },
    profiles,
    tags,
    categories,
  };
}

// Updated DEFAULT_SETTINGS to include regex-based tags
export const DEFAULT_SETTINGS: SettingsData = {
  odoo: {
    url: "",
    apiKey: "",
    imageVerticalCropRatio: 0.06,
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
};
