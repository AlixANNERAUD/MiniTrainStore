import { reactive, watch, toRefs } from "vue";
import { storage } from "@wxt-dev/storage";

export function defineWxtStore<
  S extends object,
  A extends Record<string, Function>,
>(
  key: string,
  { state: stateInit, actions }: { state: () => S; actions: (state: S) => A },
) {
  // --- STATIC CORE (Runs once per context) ---
  const storageKey = `local:${key}` as `local:${string}`;
  const state = reactive(stateInit()) as S;

  // 1. Initial Load
  storage.getItem<S>(storageKey).then((saved) => {
    if (saved) {
      Object.assign(state, saved);
      console.log(`[Store: ${key}] Data hydrated from storage.`);
    } else {
      console.log(`[Store: ${key}] No saved data found, using defaults.`);
    }
  });

  // 2. The SINGLE cross-context listener
  storage.watch<S>(storageKey, (newValue) => {
    if (newValue) Object.assign(state, newValue);
  });

  // 3. The SINGLE persistence listener
  watch(
    state,
    (newValue) => {
      storage.setItem(storageKey, newValue);
    },
    { deep: true },
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
