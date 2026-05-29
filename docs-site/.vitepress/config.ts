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
    logo: "/mark.svg",
    siteTitle: "Midnight DID",
    search: { provider: "local" },
    nav: [
      { text: "Guide", link: "/guide/" },
      { text: "Spec", link: "/spec/" },
      { text: "Packages", link: "/packages/" },
      { text: "Source", link: "/source/" },
      { text: "GitHub", link: "https://github.com/midnightntwrk/midnight-did" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Overview", link: "/guide/" },
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
          text: "TypeScript Packages",
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
      "/source/": [
        {
          text: "Source Documents",
          items: [
            { text: "Overview", link: "/source/" },
            { text: "Repository README", link: "/source/repository-overview" },
            { text: "Contract README", link: "/source/contract-readme" },
            { text: "API README", link: "/source/api-readme" },
            { text: "Domain README", link: "/source/domain-readme" },
            { text: "DID README", link: "/source/did-readme" },
            {
              text: "Method Spec Source",
              link: "/source/spec-midnight-method",
            },
            { text: "Traits Source", link: "/source/spec-midnight-did-traits" },
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
