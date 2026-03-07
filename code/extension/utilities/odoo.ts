import { useSettingsStore } from "@/stores/settings";
import { getCategoryForProduct } from "./category";
import { CombinedProduct, ProductState } from "./settings";
import { getTagsForProduct } from "./tag";
import { z } from "zod";

// Caches
const TAGS_ID_CACHE: Map<string, number> = new Map();
const CATEGORY_ID_CACHE: Map<string, number> = new Map();
const PUBLIC_CATEGORY_ID_CACHE: Map<string, number> = new Map();
const TAX_ID_CACHE: Map<string, number> = new Map();

export interface OdooConfig {
  url: string;
  apiKey: string;
  apiPath?: string; // Optional API path prefix (e.g., '/api', '/api/v1')
}

export interface OdooExportResult {
  success: boolean;
  productId?: number;
  created?: boolean;
  updated?: boolean;
  archived?: boolean;
  error?: string;
}

export interface OdooBulkExportResult {
  success: boolean;
  created: number;
  updated: number;
  archived: number;
  errors: Array<{ productId: string; error: string }>;
}

export const SearchResponseSchema = z.array(
  z.object({
    id: z.number(),
    display_name: z.string(),
  }),
);

export interface ProductTemplateRequest {
  name: string;
  list_price: number;
  website_published: boolean;
  qty_available: number;
  description_ecommerce: string;
  product_tag_ids: [number, number, number[]][];
  taxes_id: [number, number, number[]][];
  default_code: string;
  create_date: string;
  publish_date: string;
  write_date: string;
  image_1920?: string; // base64-encoded image
  categ_id?: number; // category ID
  public_categ_ids?: [number, number, number[]][];
  product_template_image_ids?: [number, number, number[]][];
}

async function requestOdoo(
  model: string,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const settings = useSettingsStore();

  const apiUrl = `${settings.odoo.value.url}/${model}/${method}`;

  const headers = {
    Authorization: `bearer ${settings.odoo.value.apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": "MiniTrainStore Extension",
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Odoo API error ${response.status}: ${errorText || response.statusText}`,
    );
  }

  return await response.json();
}

function stringToHtml(str: string): string {
  str = str.replace("\n", "<br/>");
  return str;
}

export async function getAllProducts(): Promise<
  {
    identifier: string;
    active: boolean;
  }[]
> {
  const ResponseSchema = z.array(
    z.object({
      id: z.number(),
      display_name: z.string(),
      default_code: z.union([z.string(), z.boolean()]),
      active: z.boolean(),
    }),
  );

  const response = await requestOdoo("product.template", "search_read", {
    fields: ["display_name", "default_code", "active"],
    domain: ["default_code", "ilike", "a%"], // Example: fetch all products with default_code starting with 'a'
  });

  const records = ResponseSchema.parse(response);

  return records
    .filter(
      (
        record,
      ): record is {
        id: number;
        display_name: string;
        default_code: string;
        active: boolean;
      } => typeof record.default_code === "string",
    )
    .map((record) => ({
      identifier: record.default_code,
      active: record.active,
    }));
}

// Search for product by title
async function searchProduct(product: CombinedProduct): Promise<number | null> {
  try {
    const reponse = await requestOdoo("product.template", "search_read", {
      fields: ["display_name", "default_code"],
      domain: [["default_code", "=", product.identifier]],
    });

    const records = SearchResponseSchema.parse(reponse);

    console.log(
      `Products found for article '${product.listing.title}':`,
      records,
    );

    if (!records || records.length === 0) {
      return null;
    }

    // search_read returns array of records with {id: ...}
    return records[0].id;
  } catch (error) {
    throw new Error(
      `Error searching for product '${product.listing.title}': ${error}`,
    );
  }
}

// Archive product
async function archiveProducts(productIds: number[]): Promise<void> {
  await requestOdoo("product.template", "action_archive", {
    ids: productIds,
    context: {},
  });

  console.log(`Product(s) archived with IDs: ${productIds.join(", ")}`);
}

// Get or fetch category ID
async function getCategoryId(categoryName: string): Promise<number> {
  const cached = CATEGORY_ID_CACHE.get(categoryName);
  if (cached !== undefined) return cached;

  const response = await requestOdoo("product.category", "search_read", {
    fields: ["display_name"],
    domain: [["display_name", "=", categoryName]],
  });

  const records = SearchResponseSchema.parse(response);

  if (!records || records.length === 0) {
    throw new Error(`Category '${categoryName}' not found in Odoo.`);
  }

  const id = records[0].id;
  CATEGORY_ID_CACHE.set(categoryName, id);
  return id;
}

// Get or fetch public category ID
async function getPublicCategoryId(
  categoryName: string,
): Promise<number | null> {
  const cached = PUBLIC_CATEGORY_ID_CACHE.get(categoryName);
  if (cached !== undefined) return cached;

  const response = await requestOdoo("product.public.category", "search_read", {
    fields: ["display_name"],
    domain: [["display_name", "=", categoryName]],
  });

  const records = SearchResponseSchema.parse(response);

  if (!records || records.length === 0) {
    console.warn(`Public Category '${categoryName}' not found in Odoo.`);
    return null;
  }

  const id = records[0].id;
  PUBLIC_CATEGORY_ID_CACHE.set(categoryName, id);
  return id;
}

// Get or fetch tag ID
async function getTagId(tagName: string): Promise<number> {
  const cached = TAGS_ID_CACHE.get(tagName);
  if (cached !== undefined) return cached;

  const response = await requestOdoo("product.tag", "search_read", {
    fields: ["display_name"],
    domain: [["display_name", "=", tagName]],
  });

  const records = SearchResponseSchema.parse(response);

  if (!records || records.length === 0) {
    throw new Error(`Tag '${tagName}' not found in Odoo.`);
  }

  const id = records[0].id;
  TAGS_ID_CACHE.set(tagName, id);
  return id;
}

// Get or fetch tax ID
async function getTaxId(): Promise<number> {
  const taxName = "0% EXEMPT G";
  const cached = TAX_ID_CACHE.get(taxName);
  if (cached !== undefined) return cached;

  const response = await requestOdoo("account.tax", "search_read", {
    fields: ["display_name"],
    domain: [["display_name", "=", taxName]],
  });

  const records = SearchResponseSchema.parse(response);

  if (!records || records.length === 0) {
    throw new Error(`Tax '${taxName}' not found in Odoo.`);
  }

  const id = records[0].id;
  TAX_ID_CACHE.set(taxName, id);
  return id;
}

// Download and convert image to base64
async function downloadImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image from ${url}`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove the data URL prefix
      const base64Data = base64.split(",")[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Load images (simplified - we'll just use the first image for now)
async function loadImages(
  product: CombinedProduct,
): Promise<{ firstImage: string | null; imageIds: number[] }> {
  const imageIds: number[] = [];
  let firstImage: string | null = null;

  if (!product.detail?.photos || product.detail.photos.length === 0) {
    return { firstImage, imageIds };
  }

  // Download first image as base64 for main product image
  try {
    firstImage = await downloadImageAsBase64(product.detail.photos[0]);
  } catch (error) {
    console.error("Error downloading first image:", error);
  }

  // Note: For now, we're skipping the complex image resizing and upload logic
  // In a full implementation, you'd want to:
  // 1. Resize images to multiple sizes (128, 256, 512, 1024)
  // 2. Upload additional images via product.image/create
  // 3. Return their IDs

  return { firstImage, imageIds };
}

// Convert product to Odoo data format
async function productToOdooDict(
  product: CombinedProduct,
): Promise<ProductTemplateRequest> {
  const tags = getTagsForProduct(product);
  const tagsIds = await Promise.all(tags.map((tag) => getTagId(tag)));
  const category = getCategoryForProduct(product);
  const taxId = await getTaxId();

  const description = product.detail?.description || "";
  let descriptionHtml = stringToHtml(description);
  descriptionHtml = `${descriptionHtml}<br/>Disponible également sur <a href='${product.listing.url}'>leboncoin.fr</a>`;

  const { firstImage, imageIds } = await loadImages(product);

  const createdDate = new Date(product.listing.date)
    .toISOString()
    .replace("T", " ")
    .split(".")[0];

  const productData: ProductTemplateRequest = {
    name: product.listing.title,
    list_price: product.listing.price,
    default_code: product.identifier,
    website_published: true,
    qty_available: 1.0,
    description_ecommerce: descriptionHtml,
    product_tag_ids: [[6, 0, tagsIds]],
    taxes_id: [[6, 0, [taxId]]],
    create_date: createdDate,
    publish_date: createdDate,
    write_date: createdDate,
    image_1920: "", // to be set if firstImage is available
  };

  if (firstImage) {
    productData.image_1920 = firstImage;
  }

  if (imageIds.length > 0) {
    productData.product_template_image_ids = [[6, 0, imageIds]];
  }

  if (category) {
    try {
      productData.categ_id = await getCategoryId(category);

      const publicCategoryId = await getPublicCategoryId(category);
      if (publicCategoryId) {
        productData.public_categ_ids = [[6, 0, [publicCategoryId]]];
      }
    } catch (error) {
      throw new Error(`Error fetching category ID for '${category}': ${error}`);
    }
  }

  return productData;
}

// Create product in Odoo
async function createProduct(product: CombinedProduct): Promise<number> {
  const productData = await productToOdooDict(product);

  const response = await requestOdoo("product.template", "create", {
    vals_list: [productData],
  });

  const productIds = SearchResponseSchema.parse(response);

  const productId = Array.isArray(productIds) ? productIds[0] : productIds;
  console.log(`Product created with ID: ${productId}`);

  return productId.id;
}

// Update product in Odoo
async function updateProduct(
  productId: number,
  product: CombinedProduct,
): Promise<void> {
  const productData = await productToOdooDict(product);

  await requestOdoo("product.template", "write", {
    ids: [productId],
    vals: productData,
  });

  console.log(`Product updated with ID: ${productId}`);
}

// Export single product
export async function exportProduct(
  product: CombinedProduct,
  overwriteExisting: boolean = true,
): Promise<OdooExportResult> {
  try {
    // Search for existing product
    const existingProductId = await searchProduct(product);

    console.log(
      `Existing product ID for '${product.listing.title}':`,
      existingProductId,
    );

    if (existingProductId === null) {
      // Create new product
      const productId = await createProduct(product);
      return {
        success: true,
        productId,
        created: true,
      };
    } else {
      // Product exists
      if (
        product.listing.state === ProductState.PURCHASE_COMPLETED ||
        product.listing.state === ProductState.REMOVED
      ) {
        // Archive the product
        await archiveProducts([existingProductId]);
        return {
          success: true,
          productId: existingProductId,
          archived: true,
        };
      } else if (overwriteExisting) {
        // Update existing product
        await updateProduct(existingProductId, product);
        return {
          success: true,
          productId: existingProductId,
          updated: true,
        };
      } else {
        // Skip update
        return {
          success: true,
          productId: existingProductId,
        };
      }
    }
  } catch (error) {
    console.error(`Error exporting product ${product.listing.title}:`, error);
    return {
      success: false,
      error: String(error),
    };
  }
}

// Export multiple products
export async function exportProducts(
  products: CombinedProduct[],
  overwriteExisting: boolean = true,
): Promise<OdooBulkExportResult> {
  let created = 0;
  let updated = 0;
  let archived = 0;
  const errors: Array<{ productId: string; error: string }> = [];

  for (const product of products) {
    const result = await exportProduct(product, overwriteExisting);

    if (result.success) {
      if (result.created) created++;
      if (result.updated) updated++;
      if (result.archived) archived++;
    } else if (result.error) {
      errors.push({ productId: product.identifier, error: result.error });
    }
  }

  return {
    success: errors.length === 0,
    created,
    updated,
    archived,
    errors,
  };
}
