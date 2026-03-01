import tailwindStyles from "@/assets/tailwind.css?inline";
import { ContentScriptContext } from "wxt/utils/content-script-context";

export function getZoomFactor() {
  const htmlFontSize = parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  );
  if (!htmlFontSize || htmlFontSize === 16) {
    return 1;
  }
  return 16 / htmlFontSize;
}

export async function setupShadowUi(
  ctx: ContentScriptContext,
  component: Component,
) {
  // Create Shadow DOM UI
  const ui = await createShadowRootUi(ctx, {
    name: "volte-ui",
    position: "overlay",
    anchor: "body",
    onMount: (container) => {
      // Inject Tailwind CSS into Shadow DOM
      const style = document.createElement("style");
      // Replace :root with :host for Shadow DOM compatibility
      style.textContent = tailwindStyles.replace(/:root/g, ":host");
      container.appendChild(style);

      // Create app container
      const appContainer = document.createElement("div");
      appContainer.setAttribute("data-volte-ui", "true");

      appContainer.style.zoom = getZoomFactor().toString();
      container.appendChild(appContainer);

      // Mount Vue app
      const app = createApp(component);

      app.mount(appContainer);
    },
  });

  ui.autoMount();
  return ui;
}
