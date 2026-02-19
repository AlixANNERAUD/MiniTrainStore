import { Product, ProductState } from "@/types/product";

// Constants and mappings from Python script
const TAGS_MAP: Record<string, string[]> = {
  Jouef: ["jouef"],
  Lima: ["lima"],
  Hornby: ["hornby"],
  Roco: ["roco"],
  Piko: ["piko"],
  Märklin: ["marklin", "märklin"],
  Fleischmann: ["fleischmann"],
  H0: ["ho"],
  SNCF: ["sncf"],
};

const CATEGORY_MAP: Record<string, string[]> = {
  Wagons: [
    "wagon",
    "wagons",
    "voiture",
    "voitures",
    "fourgon",
    "allège",
    "remorque",
  ],
  Locomotives: [
    "locomotive",
    "locomotives",
    "locotracteur",
    "locotender",
    "autorail",
  ],
  Rails: [
    "trails",
    "rail",
    "aiguillage",
    "voie",
    "rails",
    "aiguillages",
    "voies",
    "croisement",
    "jonction",
    "tjd",
    "heurtoir",
    "heurtoirs",
  ],
  Décor: ["personnages", "personnage", "tunnel", "conteneurs", "bureau"],
  Coffrets: ["coffret", "coffrets"],
};

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

class OdooService {
  private config: OdooConfig;

  constructor(config: OdooConfig) {
    this.config = config;
    // Ensure URL doesn't end with a slash
    if (this.config.url.endsWith("/")) {
      this.config.url = this.config.url.slice(0, -1);
    }
    // Default API path is '/json/2' for Odoo if not specified
    if (!this.config.apiPath) {
      this.config.apiPath = "/json/2";
    }
    // Ensure API path starts with / and doesn't end with /
    if (!this.config.apiPath.startsWith("/")) {
      this.config.apiPath = "/" + this.config.apiPath;
    }
    if (this.config.apiPath.endsWith("/")) {
      this.config.apiPath = this.config.apiPath.slice(0, -1);
    }
    console.log(
      `[Odoo] Initialized with URL: ${this.config.url}${this.config.apiPath}`,
    );
  }

  private buildApiUrl(endpoint: string): string {
    // endpoint should start with /
    if (!endpoint.startsWith("/")) {
      endpoint = "/" + endpoint;
    }
    return `${this.config.url}${this.config.apiPath}${endpoint}`;
  }

  private get headers() {
    return {
      Authorization: `bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "MiniTrainStore Extension",
    };
  }

  private async raiseForStatus(response: Response): Promise<void> {
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      let errorMessage = `HTTP error ${response.status} for URL ${response.url}`;

      if (contentType?.includes("application/json")) {
        try {
          const json = await response.json();
          errorMessage += `: ${JSON.stringify(json)}`;
        } catch {
          const text = await response.text();
          errorMessage += `: ${text}`;
        }
      } else {
        const text = await response.text();
        // Truncate HTML responses
        const preview = text.substring(0, 200);
        errorMessage += `: ${preview}${text.length > 200 ? "..." : ""}`;
      }

      throw new Error(errorMessage);
    }
  }

  private async parseJsonResponse(response: Response): Promise<any> {
    const contentType = response.headers.get("content-type");

    if (!contentType?.includes("application/json")) {
      const text = await response.text();
      const preview = text.substring(0, 200);
      throw new Error(
        `Expected JSON response but got ${contentType || "unknown content type"}. ` +
          `Response preview: ${preview}${text.length > 200 ? "..." : ""}`,
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${error}`);
    }
  }

  // Search for product by title
  async searchProduct(product: Product): Promise<number | null> {
    const apiUrl = this.buildApiUrl("/product.template/search_read");
    console.log(`[Odoo] Searching for product: ${product.title}`);
    console.log(`[Odoo] API URL: ${apiUrl}`);
    console.log(`[Odoo] Request body:`, {
      domain: [["name", "=", product.title]],
    });

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          domain: [["name", "=", product.title]],
        }),
      });

      console.log(`[Odoo] Response status: ${response.status}`);
      console.log(
        `[Odoo] Response headers:`,
        Object.fromEntries(response.headers.entries()),
      );

      await this.raiseForStatus(response);
      const records = await this.parseJsonResponse(response);

      console.log(`Products found for article '${product.title}':`, records);

      if (!records || records.length === 0) {
        return null;
      }

      // search_read returns array of records with {id: ...}
      return records[0].id;
    } catch (error) {
      console.error(`[Odoo] Search failed:`, error);
      throw error;
    }
  }

  // Archive product
  async archiveProduct(productIds: number[]): Promise<void> {
    const response = await fetch(
      this.buildApiUrl("/product.template/action_archive"),
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          ids: productIds,
          context: {},
        }),
      },
    );

    await this.raiseForStatus(response);
  }

  // Get tags based on product title
  private getTags(product: Product): string[] {
    const tags: string[] = [];
    const titleWords = product.title.toLowerCase().split(/\s+/);

    for (const [brand, keywords] of Object.entries(TAGS_MAP)) {
      if (
        keywords.some((keyword) =>
          titleWords.some((word) => word.includes(keyword)),
        )
      ) {
        tags.push(brand);
      }
    }

    return tags;
  }

  // Get category based on product title
  private getCategory(product: Product): string | null {
    const titleWords = product.title.toLowerCase().split(/\s+/);

    for (const [category, keywords] of Object.entries(CATEGORY_MAP)) {
      if (
        keywords.some((keyword) =>
          titleWords.some((word) => word.includes(keyword)),
        )
      ) {
        return category;
      }
    }

    console.warn(`Category not found for article '${product.title}'`);
    return null;
  }

  // Get or fetch category ID
  private async getCategoryId(categoryName: string): Promise<number> {
    const cached = CATEGORY_ID_CACHE.get(categoryName);
    if (cached !== undefined) return cached;

    const response = await fetch(
      this.buildApiUrl("/product.category/search_read"),
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          domain: [["name", "=", categoryName]],
        }),
      },
    );

    await this.raiseForStatus(response);
    const records = await this.parseJsonResponse(response);

    if (!records || records.length === 0) {
      throw new Error(`Category '${categoryName}' not found in Odoo.`);
    }

    const id = records[0].id;
    CATEGORY_ID_CACHE.set(categoryName, id);
    return id;
  }

  // Get or fetch public category ID
  private async getPublicCategoryId(
    categoryName: string,
  ): Promise<number | null> {
    const cached = PUBLIC_CATEGORY_ID_CACHE.get(categoryName);
    if (cached !== undefined) return cached;

    const response = await fetch(
      this.buildApiUrl("/product.public.category/search"),
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          domain: [["name", "=", categoryName]],
        }),
      },
    );

    await this.raiseForStatus(response);
    const records = await this.parseJsonResponse(response);

    if (!records || records.length === 0) {
      console.warn(`Public Category '${categoryName}' not found in Odoo.`);
      return null;
    }

    const id = records[0].id;
    PUBLIC_CATEGORY_ID_CACHE.set(categoryName, id);
    return id;
  }

  // Get or fetch tag ID
  private async getTagId(tagName: string): Promise<number> {
    const cached = TAGS_ID_CACHE.get(tagName);
    if (cached !== undefined) return cached;

    const response = await fetch(this.buildApiUrl("/product.tag/search_read"), {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        domain: [["name", "=", tagName]],
      }),
    });

    await this.raiseForStatus(response);
    const records = await this.parseJsonResponse(response);

    if (!records || records.length === 0) {
      throw new Error(`Tag '${tagName}' not found in Odoo.`);
    }

    const id = records[0].id;
    TAGS_ID_CACHE.set(tagName, id);
    return id;
  }

  // Get or fetch tax ID
  private async getTaxId(): Promise<number> {
    const taxName = "0% EXEMPT G";
    const cached = TAX_ID_CACHE.get(taxName);
    if (cached !== undefined) return cached;

    const response = await fetch(this.buildApiUrl("/account.tax/search_read"), {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        domain: [["name", "=", taxName]],
      }),
    });

    await this.raiseForStatus(response);
    const records = await this.parseJsonResponse(response);

    if (!records || records.length === 0) {
      throw new Error(`Tax '${taxName}' not found in Odoo.`);
    }

    const id = records[0].id;
    TAX_ID_CACHE.set(taxName, id);
    return id;
  }

  // Convert plain string to HTML
  private stringToHtml(s: string): string {
    return s.replace(/\n/g, "<br/>");
  }

  // Download and convert image to base64
  private async downloadImageAsBase64(url: string): Promise<string> {
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
  private async loadImages(
    product: Product,
  ): Promise<{ firstImage: string | null; imageIds: number[] }> {
    const imageIds: number[] = [];
    let firstImage: string | null = null;

    if (!product.photos || product.photos.length === 0) {
      return { firstImage, imageIds };
    }

    // Download first image as base64 for main product image
    try {
      firstImage = await this.downloadImageAsBase64(product.photos[0]);
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
  private async productToOdooDict(product: Product): Promise<any> {
    const tags = this.getTags(product);
    const tagsIds = await Promise.all(tags.map((tag) => this.getTagId(tag)));
    const category = this.getCategory(product);
    const taxId = await this.getTaxId();

    const description = product.description || "";
    let descriptionHtml = this.stringToHtml(description);
    descriptionHtml = `${descriptionHtml}<br/>Disponible également sur <a href='${product.url}'>leboncoin.fr</a>`;

    const { firstImage, imageIds } = await this.loadImages(product);

    const createdDate = new Date(product.date)
      .toISOString()
      .replace("T", " ")
      .split(".")[0];

    const productData: any = {
      name: product.title,
      list_price: product.price,
      website_published: true,
      qty_available: 1.0,
      description_ecommerce: descriptionHtml,
      product_tag_ids: [[6, 0, tagsIds]],
      taxes_id: [[6, 0, [taxId]]],
      create_date: createdDate,
      publish_date: createdDate,
      write_date: createdDate,
    };

    if (firstImage) {
      productData.image_1920 = firstImage;
    }

    if (imageIds.length > 0) {
      productData.product_template_image_ids = [[6, 0, imageIds]];
    }

    if (category) {
      try {
        productData.categ_id = await this.getCategoryId(category);

        const publicCategoryId = await this.getPublicCategoryId(category);
        if (publicCategoryId) {
          productData.public_categ_ids = [[6, 0, [publicCategoryId]]];
        }
      } catch (error) {
        console.error(
          `Error setting category for product ${product.title}:`,
          error,
        );
      }
    }

    return productData;
  }

  // Create product in Odoo
  async createProduct(product: Product): Promise<number> {
    const productData = await this.productToOdooDict(product);

    const response = await fetch(this.buildApiUrl("/product.template/create"), {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        vals_list: [productData],
      }),
    });

    await this.raiseForStatus(response);
    const productIds = await this.parseJsonResponse(response);

    const productId = Array.isArray(productIds) ? productIds[0] : productIds;
    console.log(`Product created with ID: ${productId}`);

    return productId;
  }

  // Update product in Odoo
  async updateProduct(productId: number, product: Product): Promise<void> {
    const productData = await this.productToOdooDict(product);

    const response = await fetch(this.buildApiUrl("/product.template/write"), {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        ids: [productId],
        vals: productData,
      }),
    });

    await this.raiseForStatus(response);
    console.log(`Product updated with ID: ${productId}`);
  }

  // Export single product
  async exportProduct(
    product: Product,
    overwriteExisting: boolean = true,
  ): Promise<OdooExportResult> {
    try {
      // Search for existing product
      const existingProductId = await this.searchProduct(product);

      if (existingProductId === null) {
        // Create new product
        const productId = await this.createProduct(product);
        return {
          success: true,
          productId,
          created: true,
        };
      } else {
        // Product exists
        if (
          product.state === ProductState.SOLD ||
          product.state === ProductState.REMOVED
        ) {
          // Archive the product
          await this.archiveProduct([existingProductId]);
          return {
            success: true,
            productId: existingProductId,
            archived: true,
          };
        } else if (overwriteExisting) {
          // Update existing product
          await this.updateProduct(existingProductId, product);
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
      console.error(`Error exporting product ${product.title}:`, error);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  // Export multiple products
  async exportProducts(
    products: Product[],
    overwriteExisting: boolean = true,
  ): Promise<OdooBulkExportResult> {
    let created = 0;
    let updated = 0;
    let archived = 0;
    const errors: Array<{ productId: string; error: string }> = [];

    for (const product of products) {
      const result = await this.exportProduct(product, overwriteExisting);

      if (result.success) {
        if (result.created) created++;
        if (result.updated) updated++;
        if (result.archived) archived++;
      } else if (result.error) {
        errors.push({ productId: product.id, error: result.error });
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
}

export function createOdooService(config: OdooConfig): OdooService {
  return new OdooService(config);
}
