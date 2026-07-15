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
      fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif",
      themeVariables: {
        primaryColor: "#161616",
        primaryTextColor: "#e1e1e6",
        primaryBorderColor: "#0677f9",
        lineColor: "#0677f9",
        secondaryColor: "#101010",
        tertiaryColor: "#0a0a0a",
        background: "#0a0a0a",
        mainBkg: "#161616",
        secondBkg: "#101010",
        tertiaryBkg: "#0a0a0a",
        textColor: "#e1e1e6",
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
