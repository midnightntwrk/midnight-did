import { defineConfig } from "vitepress";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "midnight-did";
const base =
  process.env.DOCS_BASE ?? (process.env.GITHUB_ACTIONS ? `/${repoName}/` : "/");

export default defineConfig({
  base,
  title: "Midnight DID",
  description:
    "Documentation for the Midnight DID contract, domain model, DID mapper, and API packages.",
  cleanUrls: true,
  lastUpdated: true,
  appearance: false,
  markdown: {
    config(md) {
      const fence = md.renderer.rules.fence?.bind(md.renderer.rules);
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        if (token.info.trim() === "mermaid") {
          return `<MermaidBlock encoded="${encodeURIComponent(token.content)}" />`;
        }
        return fence
          ? fence(tokens, idx, options, env, self)
          : self.renderToken(tokens, idx, options);
      };
    },
  },
  themeConfig: {
    logo: "/midnight-header-logo.svg",
    siteTitle: "DID",
    search: { provider: "local" },
    nav: [
      { text: "Guide", link: "/guide/" },
      { text: "DID Method", link: "/spec/midnight-method" },
      { text: "Compact", link: "/compact/" },
      { text: "API Reference", link: "/api/" },
      { text: "Libs", link: "/packages/" },
      { text: "GitHub", link: "https://github.com/midnightntwrk/midnight-did" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Overview", link: "/guide/" },
            { text: "Quickstart", link: "/guide/quickstart" },
            { text: "Key Model", link: "/guide/key-model" },
            { text: "Local Development", link: "/guide/local-development" },
            { text: "Testing Strategy", link: "/guide/testing-strategy" },
            {
              text: "DID Surface Change Discipline",
              link: "/guide/did-surface-change-discipline",
            },
            {
              text: "Repository Boundaries",
              link: "/guide/repository-boundaries",
            },
            { text: "GitHub Pages", link: "/guide/github-pages" },
            { text: "Publishing", link: "/guide/publishing" },
          ],
        },
      ],
      "/packages/": [
        {
          text: "Libs",
          items: [
            { text: "Overview", link: "/packages/" },
            { text: "Domain", link: "/packages/domain" },
            { text: "Domain Examples", link: "/packages/domain-examples" },
            { text: "DID", link: "/packages/did" },
            { text: "DID Examples", link: "/packages/did-examples" },
            { text: "API", link: "/packages/api" },
            { text: "API Examples", link: "/packages/api-examples" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API",
          items: [
            { text: "Overview", link: "/api/" },
          ],
        },
      ],
      "/compact/": [
        {
          text: "Compact",
          items: [
            { text: "Contract Surface", link: "/compact/" },
          ],
        },
      ],
      "/use-cases/": [
        {
          text: "Use Cases",
          items: [
            { text: "Overview", link: "/use-cases/" },
            {
              text: "Authentication and Passkeys",
              link: "/use-cases/authentication-and-passkeys",
            },
            {
              text: "VC Signing and Verification",
              link: "/use-cases/vc-signing-and-verification",
            },
            {
              text: "Delegated Agent Authorization",
              link: "/use-cases/delegated-agent-authorization",
            },
            {
              text: "Secure Agent Discovery",
              link: "/use-cases/secure-agent-discovery",
            },
            { text: "Deferred Use Cases", link: "/use-cases/deferred" },
          ],
        },
      ],
      "/architecture/": [
        {
          text: "Architecture",
          items: [
            { text: "Overview", link: "/architecture/" },
            {
              text: "ADR: SDK and Contract Boundary",
              link: "/architecture/adr-sdk-contract-boundary",
            },
          ],
        },
      ],
      "/spec/": [
        {
          text: "Specification",
          items: [
            { text: "Overview", link: "/spec/" },
            { text: "Midnight DID Method", link: "/spec/midnight-method" },
            { text: "Midnight DID Traits", link: "/spec/midnight-did-traits" },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/midnightntwrk/midnight-did" },
    ],
    footer: {
      message: "Midnight DID reference implementation",
      copyright: "Apache-2.0",
    },
  },
});
