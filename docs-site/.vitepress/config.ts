import { defineConfig } from "vitepress";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "midnight-did";
const base = process.env.DOCS_BASE ?? (process.env.GITHUB_ACTIONS ? `/${repoName}/` : "/");

export default defineConfig({
  base,
  title: "Midnight DID",
  description: "Documentation for the Midnight DID contract, packages, and services.",
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

        return fence ? fence(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
      };
    },
  },
  themeConfig: {
    logo: "/mark.svg",
    siteTitle: "Midnight DID",
    search: {
      provider: "local",
    },
    nav: [
      { text: "Guide", link: "/guide/" },
      { text: "Packages", link: "/packages/" },
      { text: "API Reference", link: "/api/" },
      { text: "Services", link: "/services/" },
      { text: "Use Cases", link: "/use-cases/" },
      { text: "Architecture", link: "/architecture/" },
      { text: "Spec", link: "/spec/" },
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
            { text: "DID Manager Getting Started", link: "/guide/getting-started-did-manager" },
            { text: "DID Resolver Getting Started", link: "/guide/getting-started-did-resolver" },
            { text: "Testing Strategy", link: "/guide/testing-strategy" },
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
            { text: "Secret Storage", link: "/packages/secret-storage" },
            { text: "Secret Storage Examples", link: "/packages/secret-storage-examples" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API Reference",
          items: [
            { text: "Overview", link: "/api/" },
            { text: "Domain", link: "/api/reference/domain/" },
            { text: "DID", link: "/api/reference/did/" },
            { text: "API Package", link: "/api/reference/api/" },
            { text: "Secret Storage", link: "/api/reference/secret-storage/" },
          ],
        },
      ],
      "/source/": [
        {
          text: "Source Documents",
          items: [
            { text: "Overview", link: "/source/" },
            { text: "Repository README", link: "/source/repository-overview" },
            { text: "API README", link: "/source/api-readme" },
            { text: "Domain README", link: "/source/domain-readme" },
            { text: "DID README", link: "/source/did-readme" },
            { text: "Secret Storage README", link: "/source/secret-storage-readme" },
            { text: "Resolver README", link: "/source/did-resolver-service-readme" },
            { text: "Manager README", link: "/source/did-manager-service-readme" },
            { text: "Method Spec Source", link: "/source/spec-midnight-method" },
            { text: "Traits Source", link: "/source/spec-midnight-did-traits" },
          ],
        },
      ],
      "/services/": [
        {
          text: "Services",
          items: [
            { text: "Overview", link: "/services/" },
            { text: "Resolver Service", link: "/services/did-resolver-service" },
            { text: "Extending Resolver", link: "/services/did-resolver-extension" },
            { text: "Manager Service", link: "/services/did-manager-service" },
            { text: "Wallet Setup workspace", link: "/services/wallet-setup" },
            { text: "Secret Storage workspace", link: "/services/secret-storage-workspace" },
            { text: "DID Management workspace", link: "/services/did-management-workspace" },
            { text: "Extending Manager", link: "/services/did-manager-extension" },
          ],
        },
      ],
      "/use-cases/": [
        {
          text: "Use Cases",
          items: [
            { text: "Overview", link: "/use-cases/" },
            { text: "Authentication and Passkeys", link: "/use-cases/authentication-and-passkeys" },
            { text: "VC Signing and Verification", link: "/use-cases/vc-signing-and-verification" },
            { text: "Delegated Agent Authorization", link: "/use-cases/delegated-agent-authorization" },
            { text: "Secure Agent Discovery", link: "/use-cases/secure-agent-discovery" },
            { text: "Deferred Use Cases", link: "/use-cases/deferred" },
          ],
        },
      ],
      "/architecture/": [
        {
          text: "Architecture",
          items: [
            { text: "Overview", link: "/architecture/" },
            { text: "DID Manager Architecture", link: "/architecture/did-manager-service" },
            { text: "ADR: Shared Seed and Local Profiles", link: "/architecture/adr-shared-seed-and-profiles" },
            { text: "ADR: HD Key Derivation and Ledger Compatibility", link: "/architecture/adr-hd-key-derivation-and-ledger-compatibility" },
            { text: "ADR: SDK and Contract Boundary", link: "/architecture/adr-sdk-contract-boundary" },
            { text: "ADR: Resolver vs Manager Service Split", link: "/architecture/adr-service-split" },
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
