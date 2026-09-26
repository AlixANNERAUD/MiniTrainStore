import { reactive, watch, toRefs } from "vue";
import { storage } from "@wxt-dev/storage";

let debounceTimeout: ReturnType<typeof setTimeout> | null = null; // Debounce timer

export function defineWxtStore<
  S extends object,
  A extends Record<string, (...args: never[]) => unknown>,
>(
  key: string,
  { state: stateInit, actions }: { state: () => S; actions: (state: S) => A },
) {
  // --- STATIC CORE (Runs once per context) ---
  const storageKey = `local:${key}` as `local:${string}`;
  const state = reactive(stateInit()) as S;
  let lastModified = Date.now(); // Track the last modification time
  let hasLocalChanges = false;
  let applyingStorageValue = false;

  console.log(`[Store: ${key}] Initializing store...`);

  // 1. Initial Load
  storage.getItem<S>(storageKey).then((saved) => {
    if (saved && !hasLocalChanges) {
      applyingStorageValue = true;
      Object.assign(state, saved);
      applyingStorageValue = false;
      console.log(`[Store: ${key}] Data hydrated from storage.`);
    } else {
      console.log(`[Store: ${key}] No saved data found, using defaults.`);
    }
  });

  // 2. BACK FROM STORAGE
  storage.watch<S>(storageKey, (newValue) => {
    if (newValue) {
      // 💡 ONLY update if the incoming data is different from current state
      // This prevents the "Echo" from triggering another local watch
      if (JSON.stringify(state) !== JSON.stringify(newValue)) {
        const now = Date.now();
        if (now - lastModified > 100) {
          // Avoid redundant updates within 100ms
          applyingStorageValue = true;
          Object.assign(state, newValue);
          applyingStorageValue = false;
          console.log(
            `📥 [${key}] Sync: Data updated from an external context.`,
          );
        }
      }
    }
  });

  // 3. TO STORAGE
  watch(
    state,
    () => {
      if (applyingStorageValue) {
        return;
      }

      hasLocalChanges = true;
      lastModified = Date.now();
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      debounceTimeout = setTimeout(() => {
        storage.setItem(storageKey, JSON.parse(JSON.stringify(state)));
        console.log(
          `📤 [${key}] Saved: Change detected in this context after debounce.`,
        );
      }, 500);
    },
    { deep: true, flush: "sync" },
  );

  // 4. Initialize actions once
  const boundActions = actions(state);

  // --- THE HOOK ---
  // Components call this to get access to the singleton
  return () => ({
    ...toRefs(state),
    ...boundActions,
  });
}
