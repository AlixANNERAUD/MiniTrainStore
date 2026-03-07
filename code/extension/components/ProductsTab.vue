<script setup lang="ts">
import ItemMedia from "@/components/ui/item/ItemMedia.vue";
import ItemContent from "@/components/ui/item/ItemContent.vue";
import ItemTitle from "@/components/ui/item/ItemTitle.vue";
import ItemDescription from "@/components/ui/item/ItemDescription.vue";
import ItemActions from "@/components/ui/item/ItemActions.vue";
import Select from "@/components/ui/select/Select.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import ItemGroup from "@/components/ui/item/ItemGroup.vue";
import ScrollArea from "@/components/ui/scroll-area/ScrollArea.vue";
import { useSettingsStore } from "@/stores/settings";
import {
  filterAndSortProducts,
  getProductStatistics,
  OrderByLabels,
  ProductStateLabels,
} from "@/utilities/filtering";
import { CombinedProduct, ProductState } from "@/utilities/settings";
import Item from "@/components/ui/item/Item.vue";
import Separator from "@/components/ui/separator/Separator.vue";
import Badge from "@/components/ui/badge/Badge.vue";
import Button from "@/components/ui/button/Button.vue";
import { ArrowDownAZ, Eye, Filter, User } from "lucide-vue-next";
import ButtonGroup from "./ui/button-group/ButtonGroup.vue";
import { getProfileUrl } from "@/utilities/profile/location";
import { getCategoryForProduct } from "@/utilities/category";
import { getTagsForProduct } from "@/utilities/tag";
import { exportProduct, getAllProducts } from "@/utilities/odoo";
import Spinner from "./ui/spinner/Spinner.vue";

const settings = useSettingsStore();

const profilesList = computed(() => {
  return Object.entries(settings.profiles.value).map(
    ([identifier, profile]) => ({
      identifier,
      displayName: profile.displayName,
    }),
  );
});

const combinedProducts = computed(() =>
  settings.getCombinedProducts(settings.selectedProfile.value || ""),
);

const sortedAndFilteredProducts = computed(() => {
  console.log(
    "Computing sorted and filtered products for profile:",
    settings.selectedProfile.value,
  );

  if (!settings.selectedProfile.value) {
    return [];
  }

  const filteredProducts = filterAndSortProducts(
    combinedProducts.value,
    {
      state:
        settings.selectedFilter.value !== "ALL"
          ? settings.selectedFilter.value
          : undefined,
    },
    settings.selectedOrderBy.value,
  );

  return filteredProducts;
});

const productStatistics = computed(() =>
  getProductStatistics(combinedProducts.value),
);

watch(
  sortedAndFilteredProducts,
  (newProducts) => {
    console.log("Sorted and filtered products updated:", newProducts);
  },
  { deep: true },
);

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function openUrl(url: string) {
  browser.tabs.create({ url });
}

function openProfileUrl() {
  openUrl(getProfileUrl(settings.selectedProfile.value || ""));
}

const odooProducts = ref<Map<string, boolean>>(new Map());

const isLoading = ref(false);

onMounted(async () => {
  isLoading.value = true;

  getAllProducts()
    .then(
      (products) => {
        const productMap = new Map<string, boolean>();
        products.forEach((product) => {
          productMap.set(product.identifier, product.active);
        });
        odooProducts.value = productMap;
      },
      (error) => {
        console.error("Error fetching Odoo products:", error);
      },
    )
    .finally(() => {
      isLoading.value = false;
    });
});

function productExistsInOdoo(product: CombinedProduct): boolean {
  return odooProducts.value.has(product.identifier);
}

function productIsActiveInOdoo(product: CombinedProduct): boolean {
  return odooProducts.value.get(product.identifier) || false;
}

const ProductStateColors: Record<ProductState, string> = {
  [ProductState.ACTIVE]: "bg-green-100 text-green-800",
  [ProductState.PURCHASE_PENDING]: "bg-yellow-100 text-yellow-800",
  [ProductState.PURCHASE_COMPLETED]: "bg-yellow-100 text-yellow-800",
  [ProductState.REMOVED]: "bg-red-100 text-red-800",
};
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap gap-4 items-center">
      <ButtonGroup>
        <Select v-model="settings.selectedProfile.value" class="inline-flex">
          <SelectTrigger>
            <User class="w-4 h-4 mr-2" />
            <SelectValue placeholder="Sélectionnez un profil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="profile in profilesList"
              :key="profile.identifier"
              :value="profile.identifier"
            >
              {{ profile.displayName }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          :disabled="!settings.selectedProfile.value"
          @click="openProfileUrl()"
        >
          <Eye class="w-4 h-4 mr-2" />
        </Button>
      </ButtonGroup>

      <Select v-model="settings.selectedFilter.value" class="inline-flex">
        <SelectTrigger>
          <Filter class="w-4 h-4 mr-2" />
          <SelectValue placeholder="Filtrer par état" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL"
            >Tous ({{ combinedProducts.length }})</SelectItem
          >
          <SelectItem
            v-for="[key, label] in Object.entries(ProductStateLabels)"
            :key="key"
            :value="key"
          >
            {{ label }} ({{ productStatistics[key as ProductState] || 0 }})
          </SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="settings.selectedOrderBy.value" class="inline-flex">
        <SelectTrigger>
          <ArrowDownAZ class="w-4 h-4 mr-2" />
          <SelectValue placeholder="Trier par" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="[key, label] in Object.entries(OrderByLabels)"
            :key="key"
            :value="key"
          >
            {{ label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Spinner v-if="isLoading" />
    </div>

    <Separator />

    <ScrollArea class="h-100 w-full">
      <ItemGroup class="gap-4">
        <Item
          v-for="product in sortedAndFilteredProducts"
          :key="product.identifier"
          variant="outline"
          as-child
          role="listitem"
        >
          <a href="#">
            <ItemMedia class="h-full w-24" variant="image">
              <img
                :src="product.listing.thumbnail"
                :alt="product.listing.title"
              />
            </ItemMedia>
            <ItemContent>
              <ItemTitle class="line-clamp-1">
                {{ product.listing.title }}
              </ItemTitle>
              <ItemDescription>{{
                product.detail?.description
              }}</ItemDescription>
              <ItemDescription class="text-sm text-muted-foreground">
                Catégorie :
                <Badge variant="outline">
                  {{ getCategoryForProduct(product) }}
                </Badge>
              </ItemDescription>
              <ItemDescription class="text-sm text-muted-foreground">
                Étiquettes :
                <Badge
                  v-for="tag in getTagsForProduct(product)"
                  :key="tag"
                  variant="outline"
                >
                  {{ tag }}
                </Badge>
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <div class="flex flex-col items-end gap-1">
                <Badge :class="ProductStateColors[product.listing.state]">
                  {{
                    ProductStateLabels[product.listing.state] ||
                    product.listing.state
                  }}
                </Badge>
                <Badge variant="outline"> {{ product.listing.price }} € </Badge>
                <Badge variant="outline">
                  {{ formatDate(product.listing.date) }}
                </Badge>
              </div>
              <div class="flex flex-col items-start gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  :class="
                    product.detail
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  "
                  @click="openUrl(product.listing.url)"
                >
                  Détails
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  :class="[
                    'w-full',
                    'justify-center',
                    productExistsInOdoo(product) &&
                    productIsActiveInOdoo(product)
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800',
                  ]"
                  :disabled="!product.detail"
                  @click="exportProduct(product)"
                >
                  <span v-if="productExistsInOdoo(product)">Mettre à jour</span>
                  <span v-else>Odoo</span>
                </Button>
              </div>
            </ItemActions>
          </a>
        </Item>
      </ItemGroup>
    </ScrollArea>
  </div>
</template>
