<script setup lang="ts">
import { useSettingsStore } from "@/stores/settings";
import Button from "@/components/ui/button/Button.vue";
import { getProfileIdentifierFromUrl } from "@/utilities/profile/location";
import { RefreshCw, UserPlus } from "lucide-vue-next";
import { parseProfileName } from "@/utilities/profile/parsing";
import { scrapeProfileAllPages } from "@/utilities/profile/navigation";

const settings = useSettingsStore();

const currentUserIdentifier =
  getProfileIdentifierFromUrl(new URL(window.location.href)) || "";

const isProfileRegistered = settings.isProfileAdded(
  currentUserIdentifier || "",
);

const isLoading = ref(false);

function addProfile() {
  if (!currentUserIdentifier) return;

  const profileName = parseProfileName();

  if (!profileName) {
    alert(
      "Impossible de récupérer le nom du profil. Veuillez vous assurer que vous êtes sur une page de profil valide.",
    );
    return;
  }

  settings.addProfile(currentUserIdentifier, profileName);
}

function scrapeAllPages() {
  if (!isProfileRegistered) return;

  isLoading.value = true;

  scrapeProfileAllPages(currentUserIdentifier).finally(() => {
    isLoading.value = false;
  });
}
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50">
    <Button
      v-if="isProfileRegistered"
      variant="outline"
      :loading="isLoading"
      @click="scrapeAllPages"
    >
      <RefreshCw
        :class="['w-4', 'h-4', 'mr-2', isLoading ? 'animate-spin' : '']"
      />
      Récupérer toutes les annonces
    </Button>
    <Button v-else variant="outline" @click="addProfile">
      <UserPlus class="w-4 h-4 mr-2" />
      Ajouter ce profil
    </Button>
  </div>
</template>
