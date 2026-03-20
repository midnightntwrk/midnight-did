<script setup lang="ts">
import { onMounted, ref, watch } from "vue";

const props = defineProps<{
  encoded: string;
}>();

const host = ref<HTMLElement | null>(null);
const source = decodeURIComponent(props.encoded);

let mermaidApi:
  | {
      initialize: (config: Record<string, unknown>) => void;
      render: (
        id: string,
        text: string,
      ) => Promise<{
        svg: string;
      }>;
    }
  | undefined;

let initialized = false;
let renderCounter = 0;

const renderDiagram = async (): Promise<void> => {
  if (!host.value) return;

  if (!mermaidApi) {
    const mod = await import("mermaid");
    mermaidApi = mod.default;
  }

  if (!initialized) {
    mermaidApi.initialize({
      startOnLoad: false,
      theme: "base",
      securityLevel: "strict",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      themeVariables: {
        primaryColor: "#101b36",
        primaryTextColor: "#f7f8fc",
        primaryBorderColor: "#f4c66d",
        lineColor: "#8cbcff",
        secondaryColor: "#131f3d",
        tertiaryColor: "#0b1224",
        background: "#0b1224",
        mainBkg: "#101b36",
        secondBkg: "#131f3d",
        tertiaryBkg: "#0f1932",
        textColor: "#f7f8fc",
      },
    });
    initialized = true;
  }

  const id = `mermaid-diagram-${renderCounter++}`;
  const { svg } = await mermaidApi.render(id, source);
  host.value.innerHTML = svg;
};

onMounted(async () => {
  await renderDiagram();
});

watch(
  () => props.encoded,
  async () => {
    await renderDiagram();
  },
);
</script>

<template>
  <div class="mermaid-block">
    <div ref="host" class="mermaid-block__canvas" />
  </div>
</template>
