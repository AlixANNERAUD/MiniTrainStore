import ProductButton from "@/components/ProductButton.vue";
import { setupShadowUi } from "@/utilities/shadow-ui";
import { ContentScriptContext } from "wxt/utils/content-script-context";

export async function setupProductButton(ctx: ContentScriptContext) {
  const component = {
    setup() {},
    render() {
      return h(ProductButton, {});
    },
  };

  const ui = await setupShadowUi(ctx, component);

  return ui;
}
