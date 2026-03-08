<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-vue-next";
import { useSettingsStore } from "@/stores/settings";
import {
  FieldSet,
  FieldLegend,
  FieldDescription,
  FieldSeparator,
} from "@/components/ui/field";

const settings = useSettingsStore();

const startAddNew = () => {
  settings.addCategory("Nouvelle catégorie", "^[A-Z0-9]+$");
};

const deleteCategory = (index: number) => {
  settings.deleteCategory(index);
};

const moveCategoryUp = (index: number) => {
  settings.moveCategoryUp(index);
};

const moveCategoryDown = (index: number) => {
  settings.moveCategoryDown(index);
};
</script>

<template>
  <FieldSet>
    <FieldLegend>Catégories personnalisées</FieldLegend>
    <FieldDescription>
      Créez des catégories personnalisées pour classifier vos produits selon des
      motifs spécifiques (expressions régulières).
    </FieldDescription>
    <FieldSeparator />
    <!-- Existing Categories -->
    <Accordion
      v-if="settings.categories.value.length > 0"
      type="single"
      collapsible
    >
      <AccordionItem
        v-for="(category, index) in settings.categories.value"
        :key="`category-${index}`"
        :value="`category-${index}`"
      >
        <AccordionTrigger class="hover:no-underline">
          <div class="flex items-center justify-between w-full pr-2">
            <span class="text-left">{{ category.category }}</span>
            <div class="flex gap-1" @click.stop>
              <Button
                v-if="index > 0"
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                @click="moveCategoryUp(index)"
              >
                <ArrowUp class="h-4 w-4" />
              </Button>
              <Button
                v-if="index < settings.categories.value.length - 1"
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                @click="moveCategoryDown(index)"
              >
                <ArrowDown class="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                @click="deleteCategory(index)"
              >
                <Trash2 class="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div class="space-y-4 pt-4">
            <!-- Category Name -->
            <div class="space-y-2">
              <Label :for="`category-name-${index}`" class="text-sm">
                Nom de la catégorie
              </Label>
              <Input
                :id="`category-name-${index}`"
                v-model="category.category"
                placeholder="Nom de la catégorie"
              />
            </div>

            <!-- Pattern -->
            <div class="space-y-2">
              <Label :for="`category-pattern-${index}`" class="text-sm">
                Motif (expression régulière)
              </Label>
              <Input
                :id="`category-pattern-${index}`"
                v-model="category.pattern"
                placeholder="locomotive|autorail"
              />
              <p class="text-xs text-muted-foreground">
                Exemples: \bwagon\b, locomotive|motrice, voiture.*
              </p>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>

    <!-- Add Button -->
    <Button variant="outline" size="sm" class="w-full" @click="startAddNew">
      <Plus class="h-4 w-4 mr-2" />
      Ajouter une catégorie
    </Button>
  </FieldSet>
</template>
