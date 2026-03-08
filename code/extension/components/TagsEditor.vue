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
  settings.addTag("Nouveau tag", "^[A-Z0-9]+$");
};

const deleteTag = (index: number) => {
  settings.deleteTag(index);
};

const moveTagUp = (index: number) => {
  settings.moveTagUp(index);
};

const moveTagDown = (index: number) => {
  settings.moveTagDown(index);
};
</script>

<template>
  <FieldSet>
    <FieldLegend>Tags personnalisés</FieldLegend>
    <FieldDescription>
      Créez des tags personnalisés pour organiser vos produits selon des motifs
      spécifiques (expressions régulières).
    </FieldDescription>
    <FieldSeparator />
    <!-- Existing Tags -->
    <Accordion v-if="settings.tags.value.length > 0" type="single" collapsible>
      <AccordionItem
        v-for="(tag, index) in settings.tags.value"
        :key="`tag-${index}`"
        :value="`tag-${index}`"
      >
        <AccordionTrigger class="hover:no-underline">
          <div class="flex items-center justify-between w-full pr-2">
            <span class="text-left">{{ tag.tag }}</span>
            <div class="flex gap-1" @click.stop>
              <Button
                v-if="index > 0"
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                @click="moveTagUp(index)"
              >
                <ArrowUp class="h-4 w-4" />
              </Button>
              <Button
                v-if="index < settings.tags.value.length - 1"
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                @click="moveTagDown(index)"
              >
                <ArrowDown class="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                @click="deleteTag(index)"
              >
                <Trash2 class="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div class="space-y-4 pt-4">
            <!-- Tag Name -->
            <div class="space-y-2">
              <Label :for="`tag-name-${index}`" class="text-sm">
                Nom du tag
              </Label>
              <Input
                :id="`tag-name-${index}`"
                v-model="tag.tag"
                placeholder="Nom du tag"
              />
            </div>

            <!-- Pattern -->
            <div class="space-y-2">
              <Label :for="`tag-pattern-${index}`" class="text-sm">
                Motif (expression régulière)
              </Label>
              <Input
                :id="`tag-pattern-${index}`"
                v-model="tag.pattern"
                placeholder="^[A-Z0-9]+$"
              />
              <p class="text-xs text-muted-foreground">
                Exemples: \bjouef\b, \blima\b, locomotive.*
              </p>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>

    <!-- Add Button -->
    <Button variant="outline" size="sm" class="w-full" @click="startAddNew">
      <Plus class="h-4 w-4 mr-2" />
      Ajouter un tag
    </Button>
  </FieldSet>
</template>
