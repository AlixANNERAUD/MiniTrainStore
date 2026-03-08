import { ref, watch, type Ref } from "vue";
import { storage } from "wxt/utils/storage";

export function storageRef<T>(key: string, defaultValue: T): Ref<T> {
  // Use 'local:' for persistence across browser restarts
  const storageItem = storage.defineItem<T>(`local:${key}`, {
    defaultValue,
  });

  const refValue = ref(defaultValue) as Ref<T>;
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null; // Debounce timer
  let lastModified = Date.now(); // Track the last modification time

  // 1. Initial Load
  storageItem.getValue().then((val: T | undefined) => {
    refValue.value = val ?? defaultValue;
  });

  // 2. Watch Ref -> Storage
  watch(
    refValue,
    (newValue) => {
      const now = Date.now();
      if (now - lastModified > 100) {
        lastModified = now;
        if (debounceTimeout) {
          clearTimeout(debounceTimeout); // Clear the previous debounce timer
        }
        debounceTimeout = setTimeout(() => {
          storageItem.setValue(newValue);
        }, 500); // Wait 500ms before saving
      }
    },
    { deep: true },
  );

  // 3. Watch Storage -> Ref (Crucial for multi-context sync)
  storageItem.watch((newValue: T | undefined) => {
    if (newValue !== undefined && newValue !== refValue.value) {
      const now = Date.now();
      if (now - lastModified > 100) {
        lastModified = now;
        refValue.value = newValue ?? defaultValue;
      }
    }
  });

  return refValue;
}

export function openUrl(url: string) {
  browser.tabs.create({ url });
}

export function downloadStringAsFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
