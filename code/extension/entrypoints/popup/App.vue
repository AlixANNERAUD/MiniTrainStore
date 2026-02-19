<script lang="ts" setup>
import { ref, onMounted, computed } from "vue";
import { Product, ProductState, ProfileData } from "@/types/product";

const profiles = ref<ProfileData[]>([]);
const selectedProfile = ref<string | null>(null);
const loading = ref(true);
const sortBy = ref<"date" | "price">("date");
const filterState = ref<ProductState | "ALL">("ALL");
const showOdooSettings = ref(false);
const odooUrl = ref("");
const odooApiKey = ref("");
const odooApiPath = ref("/json/2");
const exportingToOdoo = ref(false);
const exportingProductId = ref<string | null>(null);

onMounted(async () => {
  await loadProfiles();
  await loadOdooSettings();
});

async function loadOdooSettings() {
  const url = (await storage.getItem("local:odooUrl")) as string | undefined;
  const apiKey = (await storage.getItem("local:odooApiKey")) as
    | string
    | undefined;
  const apiPath = (await storage.getItem("local:odooApiPath")) as
    | string
    | undefined;
  if (url) odooUrl.value = url;
  if (apiKey) odooApiKey.value = apiKey;
  if (apiPath) odooApiPath.value = apiPath;
}

async function saveOdooSettings() {
  await storage.setItem("local:odooUrl", odooUrl.value);
  await storage.setItem("local:odooApiKey", odooApiKey.value);
  await storage.setItem("local:odooApiPath", odooApiPath.value);
  showOdooSettings.value = false;
}

async function loadProfiles() {
  loading.value = true;
  try {
    // Load directly from storage
    const profilesData =
      (await storage.getItem<Record<string, ProfileData>>("local:profiles")) ||
      {};
    console.log("Storage result:", profilesData);

    profiles.value = Object.values(profilesData);
    console.log("Loaded profiles:", profiles.value);

    // Auto-select first profile if available
    if (profiles.value.length > 0 && !selectedProfile.value) {
      selectedProfile.value = profiles.value[0].username;
    }
  } catch (error) {
    console.error("Error loading profiles:", error);
  } finally {
    loading.value = false;
  }
}

const currentProfile = computed(() => {
  return profiles.value.find((p) => p.username === selectedProfile.value);
});

const currentProducts = computed(() => {
  if (!currentProfile.value) return [];

  const listings = currentProfile.value.listings || {};
  const details = currentProfile.value.details || {};
  const odooExports = currentProfile.value.odooExports || {};

  // Combine listings with their details and export status
  return Object.values(listings).map((listing) => {
    const detail = details[listing.id];
    const odooExport = odooExports[listing.id];
    return {
      ...listing,
      description: detail?.description,
      photos: detail?.photos,
      detailsScrapedAt: detail?.scrapedAt,
      odooExport,
    };
  });
});

const sortedAndFilteredProducts = computed(() => {
  let filtered = currentProducts.value;

  // Filter by state
  if (filterState.value !== "ALL") {
    filtered = filtered.filter((p) => p.state === filterState.value);
  }

  // Sort
  const sorted = [...filtered];
  if (sortBy.value === "date") {
    sorted.sort((a, b) => {
      // Put sold items at the end
      if (a.state === ProductState.SOLD && b.state !== ProductState.SOLD)
        return 1;
      if (a.state !== ProductState.SOLD && b.state === ProductState.SOLD)
        return -1;

      // Sort by date (newest first)
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  } else if (sortBy.value === "price") {
    sorted.sort((a, b) => a.price - b.price);
  }

  return sorted;
});

const totalProducts = computed(() => {
  return profiles.value.reduce((sum, profile) => {
    return sum + Object.keys(profile.listings || {}).length;
  }, 0);
});

function formatPrice(price: number): string {
  return `${price.toLocaleString("fr-FR")} €`;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

async function clearAllProfiles() {
  if (
    confirm(
      "Voulez-vous vraiment supprimer tous les profils et leurs annonces ?",
    )
  ) {
    await storage.setItem("local:profiles", {});
    await loadProfiles();
    selectedProfile.value = null;
  }
}

async function clearCurrentProfile() {
  if (!selectedProfile.value) return;

  if (
    confirm(
      `Voulez-vous vraiment supprimer le profil ${selectedProfile.value} et ses annonces ?`,
    )
  ) {
    const profilesData =
      (await storage.getItem<Record<string, ProfileData>>("local:profiles")) ||
      {};

    delete profilesData[selectedProfile.value];
    await storage.setItem("local:profiles", profilesData);

    selectedProfile.value = null;
    await loadProfiles();
  }
}

function openUrl(url: string) {
  browser.tabs.create({ url });
}

async function downloadRawData() {
  try {
    const profilesData =
      (await storage.getItem<Record<string, ProfileData>>("local:profiles")) ||
      {};
    const dataStr = JSON.stringify(profilesData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `leboncoin-scraper-${new Date().toISOString().split("T")[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading data:", error);
  }
}

async function exportToOdoo() {
  if (!odooUrl.value || !odooApiKey.value) {
    showOdooSettings.value = true;
    return;
  }

  if (!currentProfile.value) {
    alert("Veuillez sélectionner un profil");
    return;
  }

  // Get active products with details (excluding sold/removed)
  const productsToExport = currentProducts.value.filter(
    (p) =>
      p.state === ProductState.ACTIVE &&
      p.description &&
      p.photos &&
      p.photos.length > 0,
  );

  if (productsToExport.length === 0) {
    alert("Aucun produit actif avec détails à exporter");
    return;
  }

  if (!confirm(`Exporter ${productsToExport.length} produit(s) vers Odoo ?`)) {
    return;
  }

  exportingToOdoo.value = true;

  try {
    // Send products to background script for Odoo export
    const response = await browser.runtime.sendMessage({
      type: "EXPORT_TO_ODOO",
      odooUrl: odooUrl.value,
      odooApiKey: odooApiKey.value,
      odooApiPath: odooApiPath.value,
      username: selectedProfile.value,
      products: productsToExport,
      productIds: productsToExport.map((p) => p.id),
    });

    if (response.success) {
      let message = `Export réussi!\n${response.created} créés, ${response.updated} mis à jour`;
      if (response.archived > 0) {
        message += `, ${response.archived} archivés`;
      }
      if (response.errors && response.errors.length > 0) {
        message += `\n\n⚠️ ${response.errors.length} erreur(s)`;
      }
      alert(message);
      await loadProfiles(); // Reload to show updated export status
    } else {
      alert(`Erreur lors de l'export: ${response.error}`);
    }
  } catch (error) {
    console.error("Error exporting to Odoo:", error);
    alert(`Erreur: ${error}`);
  } finally {
    exportingToOdoo.value = false;
  }
}

async function exportSingleProduct(product: Product, event: Event) {
  event.stopPropagation(); // Prevent opening the URL

  if (!odooUrl.value || !odooApiKey.value) {
    showOdooSettings.value = true;
    return;
  }

  if (!selectedProfile.value) {
    alert("Veuillez sélectionner un profil");
    return;
  }

  // Check if product has details
  if (!product.description || !product.photos || product.photos.length === 0) {
    alert(
      "Ce produit n'a pas de détails (description/photos). Visitez la page de l'annonce pour les récupérer.",
    );
    return;
  }

  exportingProductId.value = product.id;

  try {
    const response = await browser.runtime.sendMessage({
      type: "EXPORT_SINGLE_TO_ODOO",
      odooUrl: odooUrl.value,
      odooApiKey: odooApiKey.value,
      odooApiPath: odooApiPath.value,
      username: selectedProfile.value,
      product: product,
    });

    if (response.success) {
      let message = "Export réussi!";
      if (response.created) message = "✓ Produit créé dans Odoo";
      if (response.updated) message = "✓ Produit mis à jour dans Odoo";
      if (response.archived) message = "✓ Produit archivé dans Odoo";
      alert(message);
      await loadProfiles(); // Reload to show updated export status
    } else {
      alert(`Erreur: ${response.error}`);
    }
  } catch (error) {
    console.error("Error exporting product:", error);
    alert(`Erreur: ${error}`);
  } finally {
    exportingProductId.value = null;
  }
}
</script>

<template>
  <div
    class="min-w-[700px] max-w-[900px] min-h-[500px] max-h-[500px] bg-gray-50 flex flex-col overflow-hidden"
  >
    <!-- Header -->
    <div class="bg-orange-500 text-white p-4 shadow-md">
      <h1 class="text-2xl font-bold">Leboncoin Scraper</h1>
      <p class="text-sm opacity-90">
        {{ profiles.length }} profil(s) · {{ totalProducts }} annonce(s) au
        total
      </p>
      <!-- Debug info -->
      <details class="text-xs mt-2 opacity-75">
        <summary class="cursor-pointer">Debug info</summary>
        <pre
          class="mt-2 bg-black bg-opacity-20 p-2 rounded overflow-auto max-h-32"
          >{{
            {
              profilesCount: profiles.length,
              selectedProfile,
              currentProductsCount: currentProducts.length,
              profileUsernames: profiles.map((p) => p.username),
            }
          }}</pre
        >
      </details>
    </div>

    <!-- Profile Selector & Controls -->
    <div
      v-if="profiles.length > 0"
      class="p-4 bg-white border-b border-gray-200"
    >
      <div class="flex gap-4 items-center mb-3">
        <div class="flex-1">
          <label class="text-sm font-medium text-gray-700 mr-2">Profil:</label>
          <select
            v-model="selectedProfile"
            class="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option
              v-for="profile in profiles"
              :key="profile.username"
              :value="profile.username"
            >
              {{ profile.profileName || profile.username }} ({{
                Object.keys(profile.listings || {}).length
              }})
            </option>
          </select>
        </div>

        <button
          @click="loadProfiles"
          class="px-4 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition"
        >
          ⟳ Actualiser
        </button>

        <button
          @click="downloadRawData"
          class="px-4 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition"
        >
          💾 Export JSON
        </button>

        <button
          @click="exportToOdoo"
          :disabled="exportingToOdoo"
          class="px-4 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 transition disabled:opacity-50"
        >
          <span v-if="exportingToOdoo">⏳ Export...</span>
          <span v-else>🚀 Export Odoo</span>
        </button>

        <button
          @click="showOdooSettings = true"
          class="px-4 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition"
          title="Configurer Odoo"
        >
          ⚙️
        </button>

        <button
          v-if="selectedProfile"
          @click="clearCurrentProfile"
          class="px-4 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 transition"
        >
          🗑️ Ce profil
        </button>

        <button
          @click="clearAllProfiles"
          class="px-4 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition"
        >
          🗑️ Tout
        </button>
      </div>

      <div
        v-if="currentProfile"
        class="flex gap-4 items-center text-xs text-gray-600 mb-3"
      >
        <span v-if="currentProfile.profileName" class="font-medium">{{
          currentProfile.profileName
        }}</span>
        <span
          >Dernière mise à jour:
          {{ formatDateTime(currentProfile.lastScraped) }}</span
        >
        <span>{{ currentProducts.length }} annonce(s)</span>
      </div>
    </div>

    <!-- Loading State -->
    <div
      v-if="loading"
      class="flex-1 flex items-center justify-center text-gray-500"
    >
      <div class="text-center">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"
        ></div>
        Chargement...
      </div>
    </div>

    <!-- Empty State - No Profiles -->
    <div
      v-else-if="profiles.length === 0"
      class="flex-1 flex items-center justify-center text-gray-500"
    >
      <div class="text-center p-8">
        <div class="text-4xl mb-4">👤</div>
        <p class="text-lg font-medium mb-2">Aucun profil scrapé</p>
        <p class="text-sm">Rendez-vous sur un profil leboncoin.fr</p>
        <p class="text-sm">Le scraping se fera automatiquement</p>
      </div>
    </div>

    <!-- Empty State - No Products for Selected Profile -->
    <div
      v-else-if="currentProducts.length === 0"
      class="flex-1 flex items-center justify-center text-gray-500"
    >
      <div class="text-center p-8">
        <div class="text-4xl mb-4">📦</div>
        <p class="text-lg font-medium mb-2">Aucune annonce pour ce profil</p>
      </div>
    </div>

    <!-- Empty State - All Filtered Out -->
    <div
      v-else-if="sortedAndFilteredProducts.length === 0"
      class="flex-1 flex items-center justify-center text-gray-500"
    >
      <div class="text-center p-8">
        <div class="text-4xl mb-4">🔍</div>
        <p class="text-lg font-medium mb-2">Aucun résultat avec ces filtres</p>
        <p class="text-sm">
          {{ currentProducts.length }} annonce(s) disponible(s) au total
        </p>
      </div>
    </div>

    <!-- Products List -->
    <div v-else class="flex-1 overflow-y-auto">
      <div
        v-for="product in sortedAndFilteredProducts"
        :key="product.url"
        class="p-4 border-b border-gray-200 hover:bg-gray-100 transition"
      >
        <div class="flex gap-4 items-start">
          <!-- Thumbnail -->
          <div
            v-if="product.thumbnail"
            class="flex-shrink-0 cursor-pointer"
            @click="openUrl(product.url)"
          >
            <img
              :src="product.thumbnail"
              :alt="product.title"
              class="w-24 h-24 object-cover rounded-lg"
            />
          </div>
          <div
            v-else
            class="flex-shrink-0 w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 cursor-pointer"
            @click="openUrl(product.url)"
          >
            <span class="text-2xl">📦</span>
          </div>

          <!-- Content -->
          <div
            class="flex-1 min-w-0 cursor-pointer"
            @click="openUrl(product.url)"
          >
            <h3 class="font-semibold text-gray-900 mb-1">
              {{ product.title }}
            </h3>
            <p class="text-sm text-gray-600 mb-2">{{ product.datePosted }}</p>
            <div class="flex gap-2 items-center flex-wrap">
              <!-- State Badge -->
              <span
                :class="{
                  'bg-green-100 text-green-800':
                    product.state === ProductState.ACTIVE,
                  'bg-red-100 text-red-800':
                    product.state === ProductState.SOLD,
                  'bg-gray-100 text-gray-800':
                    product.state === ProductState.REMOVED,
                }"
                class="px-2 py-1 rounded text-xs font-medium"
              >
                {{ product.state }}
              </span>

              <!-- Photos Badge -->
              <span
                v-if="product.detailsScrapedAt"
                class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium"
                :title="`Détails scrapés le ${formatDateTime(product.detailsScrapedAt)}`"
              >
                📷 {{ product.photos?.length || 0 }} photo(s)
              </span>

              <!-- Odoo Export Status Badge -->
              <span
                v-if="product.odooExport?.exported"
                class="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium"
                :title="`Exporté le ${formatDateTime(product.odooExport.lastExportedAt || '')}`"
              >
                ✓ Odoo #{{ product.odooExport.odooProductId }}
              </span>
              <span
                v-else-if="product.odooExport?.exportError"
                class="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium"
                :title="product.odooExport.exportError"
              >
                ✗ Erreur export
              </span>
              <span
                v-else-if="
                  product.state === ProductState.ACTIVE &&
                  product.description &&
                  product.photos?.length
                "
                class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium"
              >
                ⊘ Non exporté
              </span>
            </div>
          </div>

          <!-- Price & Export Button -->
          <div class="text-right flex-shrink-0 flex flex-col items-end gap-2">
            <p
              class="text-xl font-bold text-orange-600 cursor-pointer"
              @click="openUrl(product.url)"
            >
              {{ formatPrice(product.price) }}
            </p>

            <!-- Export Button (only for active products with details) -->
            <button
              v-if="
                product.state === ProductState.ACTIVE &&
                product.description &&
                product.photos?.length
              "
              @click="(e) => exportSingleProduct(product, e)"
              :disabled="exportingProductId === product.id"
              class="px-3 py-1 bg-purple-500 text-white rounded text-xs hover:bg-purple-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              :title="
                product.odooExport?.exported
                  ? 'Mettre à jour dans Odoo'
                  : 'Exporter vers Odoo'
              "
            >
              <span v-if="exportingProductId === product.id">⏳</span>
              <span v-else-if="product.odooExport?.exported">🔄</span>
              <span v-else>🚀</span>
              {{
                exportingProductId === product.id
                  ? "..."
                  : product.odooExport?.exported
                    ? "MAJ"
                    : "Export"
              }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Odoo Settings Modal -->
    <div
      v-if="showOdooSettings"
      class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="showOdooSettings = false"
    >
      <div class="bg-white rounded-lg p-6 w-96 shadow-xl">
        <h2 class="text-xl font-bold mb-4">Configuration Odoo</h2>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2"
            >URL Odoo</label
          >
          <input
            v-model="odooUrl"
            type="text"
            placeholder="https://votre-instance.odoo.com"
            class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <p class="text-xs text-gray-500 mt-1">
            URL de base sans /api (ex: https://www.minitrainstore.fr)
          </p>
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2"
            >Chemin API</label
          >
          <input
            v-model="odooApiPath"
            type="text"
            placeholder="/json/2"
            class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <p class="text-xs text-gray-500 mt-1">
            Préfixe du chemin API Odoo (par défaut: /json/2)
          </p>
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2"
            >Clé API</label
          >
          <input
            v-model="odooApiKey"
            type="password"
            placeholder="Votre clé API Odoo"
            class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <p class="text-xs text-gray-500 mt-1">
            Token d'authentification bearer (vérifiez les logs de la console
            pour les erreurs)
          </p>
        </div>

        <div class="flex gap-2 justify-end">
          <button
            @click="showOdooSettings = false"
            class="px-4 py-2 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400 transition"
          >
            Annuler
          </button>
          <button
            @click="saveOdooSettings"
            class="px-4 py-2 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 transition"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Additional custom styles if needed */
</style>
