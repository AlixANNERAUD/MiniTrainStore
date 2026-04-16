<script setup lang="ts">
import ProductItem from "@/components/ProductItem.vue";
import Button from "@/components/ui/button/Button.vue";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import Input from "@/components/ui/input/Input.vue";
import ScrollArea from "@/components/ui/scroll-area/ScrollArea.vue";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectGroup from "@/components/ui/select/SelectGroup.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectLabel from "@/components/ui/select/SelectLabel.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import { useSettingsStore } from "@/stores/settings";
import { CombinedProduct, ProductState } from "@/utilities/settings";
import * as odoo from "@/utilities/odoo";
import { openUrl } from "@/utilities/browser";

interface EditableManualProduct {
  id: number | null;
  name: string;
  default_code: string;
  list_price: number;
  weight: number;
  active: boolean;
  website_published: boolean;
  description_text: string;
  category_id: string;
  tag_ids: string[];
  website_absolute_url: string;
  image_1920: string;
  gallery_images: string[];
}

const settings = useSettingsStore();
const isLoading = ref(false);
const isSaving = ref(false);
const isEditorOpen = ref(false);
const products = ref<odoo.OdooManualProduct[]>([]);
const availableCategories = ref<odoo.OdooReferenceOption[]>([]);
const availableTags = ref<odoo.OdooReferenceOption[]>([]);
const selectedProductId = ref<number | null>(null);
type ManualFilter = "ALL" | "SYNCED" | "MANUAL";
const selectedManualFilter = ref<ManualFilter>("MANUAL");
const selectedProduct = ref<EditableManualProduct>({
  id: null,
  name: "",
  default_code: "",
  list_price: 0,
  weight: 0,
  active: true,
  website_published: true,
  description_text: "",
  category_id: "",
  tag_ids: [],
  website_absolute_url: "",
  image_1920: "",
  gallery_images: [],
});

const selectedFilesPreview = ref<string[]>([]);
const selectedMainImagePreview = ref<string>("");

const syncedIdentifiers = computed(() => {
  const ids = new Set<string>();

  Object.values(settings.profiles.value).forEach((profile) => {
    Object.keys(profile.listings).forEach((identifier) => {
      ids.add(identifier);
    });
  });

  return ids;
});

const filteredProducts = computed(() => {
  if (selectedManualFilter.value === "ALL") {
    return products.value;
  }

  return products.value.filter((product) => {
    const isSynced = syncedIdentifiers.value.has(product.default_code);
    return selectedManualFilter.value === "SYNCED" ? isSynced : !isSynced;
  });
});

const filterCounts = computed(() => {
  let synced = 0;
  let manual = 0;

  products.value.forEach((product) => {
    if (syncedIdentifiers.value.has(product.default_code)) {
      synced++;
      return;
    }
    manual++;
  });

  return {
    all: products.value.length,
    synced,
    manual,
  };
});

async function fileToBase64Data(file: File): Promise<string> {
  const reader = new FileReader();
  return await new Promise((resolve, reject) => {
    reader.onload = () => {
      const result = String(reader.result || "");
      const data = result.split(",")[1] || "";
      resolve(data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function toCombinedProduct(product: odoo.OdooManualProduct): CombinedProduct {
  const now = new Date().toISOString();

  return {
    identifier: product.default_code,
    listing: {
      title: product.name,
      price: product.list_price,
      url: product.website_absolute_url || "",
      date: now,
      state: product.active
        ? ProductState.ACTIVE
        : ProductState.PURCHASE_COMPLETED,
      thumbnail: "",
      scrapedAt: now,
    },
    detail: {
      description: product.description_ecommerce || "",
      photos: [],
      scrapedAt: now,
    },
  };
}

function mapToEditable(
  product: odoo.OdooManualProduct | null,
): EditableManualProduct {
  if (!product) {
    return {
      id: null,
      name: "",
      default_code: "",
      list_price: 0,
      weight: 0,
      active: true,
      website_published: true,
      description_text: "",
      category_id: "",
      tag_ids: [],
      website_absolute_url: "",
      image_1920: "",
      gallery_images: [],
    };
  }

  return {
    id: product.id,
    name: product.name,
    default_code: product.default_code,
    list_price: product.list_price,
    weight: product.weight,
    active: product.active,
    website_published: product.website_published,
    description_text: odoo.htmlToPlainText(product.description_ecommerce),
    category_id:
      availableCategories.value
        .find((category) => category.name === product.category_name)
        ?.id.toString() || "",
    tag_ids: product.tag_names
      .map((tagName) =>
        availableTags.value.find((tag) => tag.name === tagName)?.id.toString(),
      )
      .filter((tagId): tagId is string => !!tagId),
    website_absolute_url: product.website_absolute_url,
    image_1920: "",
    gallery_images: [],
  };
}

function toManualInput(
  product: EditableManualProduct,
): odoo.OdooManualProductInput {
  const categoryId = Number(product.category_id);
  const tagIds = product.tag_ids
    .map((tagId) => Number(tagId))
    .filter((tagId) => Number.isFinite(tagId) && tagId > 0);

  return {
    name: product.name.trim(),
    default_code: product.default_code.trim(),
    list_price: Number.isFinite(product.list_price) ? product.list_price : 0,
    weight: Number.isFinite(product.weight) ? product.weight : 0,
    active: product.active,
    website_published: product.website_published,
    description_ecommerce: odoo.plainTextToHtml(
      product.description_text.trim(),
    ),
    image_1920: product.image_1920 || undefined,
    product_template_image_ids:
      product.gallery_images.length > 0
        ? [
            [5, 0, 0],
            ...product.gallery_images.map(
              (image, index) =>
                [
                  0,
                  0,
                  {
                    name: `Image ${index + 2}`,
                    sequence: index + 2,
                    image_1920: image,
                  },
                ] as [number, number, unknown],
            ),
          ]
        : [[5, 0, 0]],
    public_categ_ids:
      Number.isFinite(categoryId) && categoryId > 0
        ? [[6, 0, [categoryId]]]
        : undefined,
    product_tag_ids: [[6, 0, tagIds]],
  };
}

function isOdooConfigured(): boolean {
  return !!settings.odoo.value.url && !!settings.odoo.value.apiKey;
}

async function refreshProducts() {
  if (!isOdooConfigured()) {
    products.value = [];
    availableCategories.value = [];
    availableTags.value = [];
    return;
  }

  isLoading.value = true;
  try {
    const [manualProducts, categories, tags] = await Promise.all([
      odoo.getManualProducts(),
      odoo.getAvailablePublicCategories(),
      odoo.getAvailableTags(),
    ]);

    products.value = manualProducts;
    availableCategories.value = categories;
    availableTags.value = tags;

    if (selectedProductId.value) {
      const fresh = products.value.find(
        (p) => p.id === selectedProductId.value,
      );
      if (fresh) {
        selectedProduct.value = mapToEditable(fresh);
      }
    }
  } catch (error) {
    console.error("Error loading Odoo products:", error);
  } finally {
    isLoading.value = false;
  }
}

function selectExistingProduct(product: odoo.OdooManualProduct) {
  selectedProductId.value = product.id;
  selectedProduct.value = mapToEditable(product);
  isEditorOpen.value = true;
}

function createNewProduct() {
  selectedProductId.value = null;
  selectedProduct.value = mapToEditable(null);
  selectedFilesPreview.value = [];
  selectedMainImagePreview.value = "";
  isEditorOpen.value = true;
}

async function onMainImageChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  selectedProduct.value.image_1920 = await fileToBase64Data(file);
  selectedMainImagePreview.value = URL.createObjectURL(file);
}

async function onGalleryImagesChange(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files || []);
  if (files.length === 0) return;

  const encoded = await Promise.all(
    files.map((file) => fileToBase64Data(file)),
  );
  selectedProduct.value.gallery_images.push(...encoded);
  selectedFilesPreview.value.push(
    ...files.map((file) => URL.createObjectURL(file)),
  );
}

function removeGalleryImage(index: number) {
  selectedProduct.value.gallery_images.splice(index, 1);
  selectedFilesPreview.value.splice(index, 1);
}

function clearMainImage() {
  selectedProduct.value.image_1920 = "";
  selectedMainImagePreview.value = "";
}

async function saveSelectedProduct() {
  const payload = toManualInput(selectedProduct.value);
  if (!payload.name || !payload.default_code) {
    alert("Nom et reference interne sont obligatoires.");
    return;
  }

  isSaving.value = true;
  try {
    if (selectedProduct.value.id === null) {
      const productId = await odoo.createManualProduct(payload);
      selectedProductId.value = productId;
    } else {
      await odoo.updateManualProduct(selectedProduct.value.id, payload);
      selectedProductId.value = selectedProduct.value.id;
    }

    await refreshProducts();
  } catch (error) {
    console.error("Error saving Odoo product:", error);
    alert(`Erreur lors de la sauvegarde: ${String(error)}`);
  } finally {
    isSaving.value = false;
  }
}

async function deleteSelectedProduct() {
  if (!selectedProduct.value.id) {
    return;
  }

  if (!confirm("Supprimer ce produit Odoo ? Cette action est irreversible.")) {
    return;
  }

  isSaving.value = true;
  try {
    await odoo.deleteManualProduct(selectedProduct.value.id);
    selectedProductId.value = null;
    selectedProduct.value = mapToEditable(null);
    selectedFilesPreview.value = [];
    selectedMainImagePreview.value = "";
    isEditorOpen.value = false;
    await refreshProducts();
  } catch (error) {
    console.error("Error deleting Odoo product:", error);
    alert(`Erreur lors de la suppression: ${String(error)}`);
  } finally {
    isSaving.value = false;
  }
}

onMounted(() => {
  selectedProduct.value = mapToEditable(null);
  refreshProducts().catch((error) => {
    console.error("Error during initial Odoo product load:", error);
  });
});
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-3">
    <div class="flex items-center gap-2">
      <Button variant="outline" :disabled="isLoading" @click="refreshProducts">
        Rafraichir
      </Button>
      <Button variant="outline" @click="createNewProduct">Nouveau</Button>
      <Select v-model="selectedManualFilter" class="inline-flex">
        <SelectTrigger>
          <SelectValue placeholder="Filtrer les produits" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Tous ({{ filterCounts.all }})</SelectItem>
          <SelectItem value="SYNCED"
            >Synchronises ({{ filterCounts.synced }})</SelectItem
          >
          <SelectItem value="MANUAL"
            >Manuels ({{ filterCounts.manual }})</SelectItem
          >
        </SelectContent>
      </Select>
    </div>

    <ScrollArea class="w-full flex-1 min-h-0">
      <div class="space-y-3 pr-2">
        <div
          v-if="!isLoading && products.length === 0"
          class="text-sm text-muted-foreground"
        >
          Aucun produit Odoo charge. Verifiez la configuration Odoo puis cliquez
          sur Rafraichir.
        </div>
        <ProductItem
          v-for="product in filteredProducts"
          :key="product.id"
          :product="toCombinedProduct(product)"
          :odoo-state="
            product.active
              ? odoo.OdooProductState.ACTIVE
              : odoo.OdooProductState.EXISTS
          "
          :odoo-url="product.website_absolute_url || null"
          :allow-export="false"
          :show-metadata="false"
          @select-product="selectExistingProduct(product)"
        />
      </div>
    </ScrollArea>
  </div>

  <Sheet v-model:open="isEditorOpen">
    <SheetContent side="right" class="!w-[92vw] !max-w-4xl p-0">
      <SheetHeader class="border-b">
        <SheetTitle>
          {{
            selectedProductId
              ? "Edition manuelle Odoo"
              : "Creation manuelle Odoo"
          }}
        </SheetTitle>
        <SheetDescription>
          Creez ou editez un produit directement dans Odoo.
        </SheetDescription>
      </SheetHeader>

      <ScrollArea class="h-[calc(100vh-7rem)] w-full">
        <FieldSet class="p-4">
          <Field>
            <FieldLabel for="manual-name">Nom</FieldLabel>
            <Input id="manual-name" v-model="selectedProduct.name" />
          </Field>

          <Field>
            <FieldLabel for="manual-default-code">Reference interne</FieldLabel>
            <Input
              id="manual-default-code"
              v-model="selectedProduct.default_code"
            />
          </Field>

          <Field>
            <FieldLabel for="manual-price">Prix</FieldLabel>
            <Input
              id="manual-price"
              v-model.number="selectedProduct.list_price"
              type="number"
              step="0.01"
              min="0"
            />
          </Field>

          <Field>
            <FieldLabel for="manual-weight">Poids (kg)</FieldLabel>
            <Input
              id="manual-weight"
              v-model.number="selectedProduct.weight"
              type="number"
              step="0.001"
              min="0"
            />
          </Field>

          <Field>
            <FieldLabel for="manual-description"
              >Description ecommerce</FieldLabel
            >
            <textarea
              id="manual-description"
              v-model="selectedProduct.description_text"
              class="w-full min-h-32 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
            <FieldDescription>
              Le texte est converti automatiquement en HTML pour Odoo.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel for="manual-category">Categorie</FieldLabel>
            <Select v-model="selectedProduct.category_id">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Choisir une categorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Categories</SelectLabel>
                  <SelectItem
                    v-for="category in availableCategories"
                    :key="category.id"
                    :value="String(category.id)"
                  >
                    {{ category.name }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel for="manual-tags">Tags</FieldLabel>
            <Select v-model="selectedProduct.tag_ids" multiple>
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Choisir des tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Tags</SelectLabel>
                  <SelectItem
                    v-for="tag in availableTags"
                    :key="tag.id"
                    :value="String(tag.id)"
                  >
                    {{ tag.name }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel for="manual-main-image">Image principale</FieldLabel>
            <Input
              id="manual-main-image"
              type="file"
              accept="image/*"
              @change="onMainImageChange"
            />
            <div
              v-if="selectedMainImagePreview"
              class="flex items-center gap-2"
            >
              <img
                :src="selectedMainImagePreview"
                alt="Main preview"
                class="h-16 w-16 object-cover rounded border"
              />
              <Button variant="outline" size="sm" @click="clearMainImage">
                Retirer
              </Button>
            </div>
          </Field>

          <Field>
            <FieldLabel for="manual-gallery-images">Images galerie</FieldLabel>
            <Input
              id="manual-gallery-images"
              type="file"
              accept="image/*"
              multiple
              @change="onGalleryImagesChange"
            />
            <div class="grid grid-cols-3 gap-2">
              <div
                v-for="(preview, index) in selectedFilesPreview"
                :key="`${preview}-${index}`"
                class="space-y-1"
              >
                <img
                  :src="preview"
                  alt="Gallery preview"
                  class="h-16 w-full object-cover rounded border"
                />
                <Button
                  variant="outline"
                  size="sm"
                  class="w-full"
                  @click="removeGalleryImage(index)"
                >
                  Retirer
                </Button>
              </div>
            </div>
          </Field>

          <Field>
            <label class="flex items-center gap-2 text-sm">
              <input v-model="selectedProduct.active" type="checkbox" />
              Actif
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input
                v-model="selectedProduct.website_published"
                type="checkbox"
              />
              Publie sur le site
            </label>
          </Field>

          <Field orientation="horizontal">
            <Button :disabled="isSaving" @click="saveSelectedProduct">
              {{ selectedProductId ? "Enregistrer" : "Creer" }}
            </Button>
            <Button
              v-if="selectedProductId"
              variant="destructive"
              :disabled="isSaving"
              @click="deleteSelectedProduct"
            >
              Supprimer
            </Button>
            <Button
              variant="outline"
              :disabled="!selectedProduct.website_absolute_url"
              @click="openUrl(selectedProduct.website_absolute_url || '')"
            >
              Voir sur Odoo
            </Button>
          </Field>
        </FieldSet>
      </ScrollArea>
    </SheetContent>
  </Sheet>
</template>
