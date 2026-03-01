import ScrapeButton from "@/components/ProfileButton.vue";
import { setupShadowUi } from "@/utilities/shadow-ui";
import { ContentScriptContext } from "wxt/utils/content-script-context";

export async function setupProfileButton(ctx: ContentScriptContext) {
  const component = {
    setup() {},
    render() {
      return h(ScrapeButton, {});
    },
  };

  const ui = await setupShadowUi(ctx, component);

  return ui;
}
