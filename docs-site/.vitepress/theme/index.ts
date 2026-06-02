import DefaultTheme from "vitepress/theme";
import type { App } from "vue";

import MermaidBlock from "./components/MermaidBlock.vue";
import "./custom.css";

export default {
  ...DefaultTheme,
  enhanceApp({ app }: { app: App }) {
    DefaultTheme.enhanceApp?.({ app });
    app.component("MermaidBlock", MermaidBlock);
  },
};
