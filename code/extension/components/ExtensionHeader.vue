<script setup lang="ts">
import CardDescription from "@/components/ui/card/CardDescription.vue";
import CardTitle from "@/components/ui/card/CardTitle.vue";
</script>

<template>
  <div class="flex items-center gap-2">
    <img src="/icon.svg" alt="Icon" class="h-6" />
    <CardTitle>Mini Train Store</CardTitle> -
    <CardDescription>Gestion des profils et des annonces</CardDescription>
    <slot />
  </div>
</template>
