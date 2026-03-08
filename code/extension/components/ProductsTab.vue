<script setup lang="ts">
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

import Separator from "@/components/ui/separator/Separator.vue";
import Input from "@/components/ui/input/Input.vue";

import Button from "@/components/ui/button/Button.vue";
import { ArrowDownAZ, Eye, Filter, Search, User } from "lucide-vue-next";
import ButtonGroup from "./ui/button-group/ButtonGroup.vue";
import { getProfileUrl } from "@/utilities/profile/location";

import * as odoo from "@/utilities/odoo";
import Spinner from "./ui/spinner/Spinner.vue";
import ProductItem from "./ProductItem.vue";
import { openUrl } from "@/utilities/browser";

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
      query: settings.searchQuery.value.trim() || undefined,
    },
    settings.selectedOrderBy.value,
  );

  return filteredProducts;
});

const productStatistics = computed(() =>
  getProductStatistics(combinedProducts.value),
);

function openProfileUrl() {
  openUrl(getProfileUrl(settings.selectedProfile.value || ""));
}

const odooProducts = ref<
  Map<
    string,
    {
      active: boolean;
      url: string;
    }
  >
>(new Map());

const isLoading = ref(false);

async function updateOdooProducts() {
  // Check if Odoo is configured before attempting to fetch
  if (!settings.odoo.value.url || !settings.odoo.value.apiKey) {
    console.warn("Odoo not configured, skipping product fetch");
    return;
  }

  isLoading.value = true;
  await odoo
    .getAllProducts()
    .then(
      (products) => {
        const productMap = new Map<string, { active: boolean; url: string }>();
        products.forEach((product) => {
          productMap.set(product.identifier, {
            active: product.active,
            url: product.url,
          });
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
}

onMounted(async () => {
  // Wait for settings to load from storage before attempting to fetch
  await new Promise((resolve) => setTimeout(resolve, 100));

  updateOdooProducts().catch((error) => {
    console.error("Error during initial Odoo products fetch:", error);
  });
});

function getOdooProductState(product: CombinedProduct): odoo.OdooProductState {
  const existsInOdoo = odooProducts.value.has(product.identifier);
  const isActiveInOdoo = odooProducts.value.get(product.identifier);

  if (!existsInOdoo) {
    return odoo.OdooProductState.NOT_FOUND;
  } else if (isActiveInOdoo) {
    return odoo.OdooProductState.ACTIVE;
  } else {
    return odoo.OdooProductState.EXISTS;
  }
}
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

      <div class="flex items-center gap-2 flex-1 min-w-fit">
        <Search class="w-4 h-4 text-muted-foreground" />
        <Input
          v-model="settings.searchQuery.value"
          placeholder="Rechercher par titre ou description..."
          class="flex-1"
        />
      </div>

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

    <ScrollArea class="w-full h-80">
      <ItemGroup class="gap-4">
        <ProductItem
          v-for="product in sortedAndFilteredProducts"
          :key="product.identifier"
          :product="product"
          :odoo-state="getOdooProductState(product)"
          :odoo-url="odooProducts.get(product.identifier)?.url || null"
          @export-product="updateOdooProducts"
        />
      </ItemGroup>
    </ScrollArea>
  </div>
</template>
