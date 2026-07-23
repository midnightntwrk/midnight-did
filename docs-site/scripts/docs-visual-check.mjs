#!/usr/bin/env node
import { createServer } from "node:http";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const distRoot = resolve(repoRoot, "docs-site/.vitepress/dist");
const artifactRoot = resolve(repoRoot, "test-results/docs-visual");
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "midnight-did";
const docsBase =
  process.env.DOCS_BASE ?? (process.env.GITHUB_ACTIONS ? `/${repoName}/` : "/");

const toPosix = (value) => value.split(sep).join("/");
const trimSlashes = (value) => value.replace(/^\/+|\/+$/gu, "");
const normalizedBase = trimSlashes(docsBase);
const basePath = normalizedBase ? `/${normalizedBase}` : "/";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const isSubpath = (parent, child) => {
  const rel = relative(parent, child);
  return (
    rel === "" ||
    (!rel.startsWith("..") && !rel.startsWith("/") && rel !== "..")
  );
};

const fileForRequest = async (requestUrl) => {
  const url = new URL(requestUrl, "http://127.0.0.1");
  let pathname = decodeURIComponent(url.pathname);

  if (basePath !== "/" && pathname.startsWith(`${basePath}/`)) {
    pathname = pathname.slice(basePath.length);
  } else if (basePath !== "/" && pathname === basePath) {
    pathname = "/";
  }

  const candidates = [];
  const normalized = pathname.replace(/^\/+/u, "");
  const directPath = resolve(distRoot, normalized);
  candidates.push(directPath);

  if (!extname(directPath)) {
    candidates.push(resolve(distRoot, `${normalized}.html`));
  }

  candidates.push(resolve(directPath, "index.html"));

  for (const candidate of candidates) {
    if (!isSubpath(distRoot, candidate)) continue;
    try {
      const fileStat = await stat(candidate);
      if (fileStat.isFile()) return candidate;
    } catch {
      // Try the next static-file candidate.
    }
  }

  return undefined;
};

const serveBuiltDocs = async () => {
  const server = createServer(async (request, response) => {
    try {
      const filePath = await fileForRequest(request.url ?? "/");
      if (!filePath) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream",
      });
      response.end(await readFile(filePath));
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });

  await new Promise((resolveListen) => {
    server.listen(0, "127.0.0.1", resolveListen);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("docs preview server did not expose a TCP address");
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolveClose, rejectClose) => {
        server.close((error) => (error ? rejectClose(error) : resolveClose()));
      }),
  };
};

const fail = (message, details) => {
  if (details) {
    throw new Error(`${message}: ${JSON.stringify(details, null, 2)}`);
  }
  throw new Error(message);
};

const rgbToParts = (value) => {
  const match = value.match(/rgba?\(([^)]+)\)/u);
  if (!match) return undefined;
  return match[1].split(",").slice(0, 3).map((part) => Number(part.trim()));
};

const luminance = (color) => {
  const parts = rgbToParts(color);
  if (!parts || parts.some((part) => Number.isNaN(part))) {
    throw new Error(`unsupported CSS color '${color}'`);
  }

  const normalized = parts.map((part) => {
    const channel = part / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * normalized[0] + 0.7152 * normalized[1] + 0.0722 * normalized[2];
};

const contrastRatio = (foreground, background) => {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

const checkNoPageOverflow = async (page, label) => {
  const overflow = await page.evaluate(() => {
    const width = window.innerWidth;
    const offenders = [...document.body.querySelectorAll("*")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === "string" ? element.className : "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((entry) => entry.width > 0 && (entry.left < -2 || entry.right > width + 2))
      .slice(0, 6);

    return {
      viewportWidth: width,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      offenders,
    };
  });

  if (overflow.documentWidth > overflow.viewportWidth + 2) {
    fail(`${label} has horizontal page overflow`, overflow);
  }
};

const checkNav = async (page, viewportName) => {
  const nav = page.locator(".VPNavBar").first();
  await nav.waitFor({ state: "visible" });

  const navLayout = await page.evaluate((isDesktop) => {
    const navRect = document.querySelector(".VPNavBar")?.getBoundingClientRect();
    const links = [...document.querySelectorAll(".VPNavBarMenuLink")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && styles.visibility !== "hidden";
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          text: element.textContent?.trim(),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
        };
      });
    const hamburger = document.querySelector(".VPNavBarHamburger")?.getBoundingClientRect();

    return {
      nav: navRect
        ? {
            left: Math.round(navRect.left),
            right: Math.round(navRect.right),
            top: Math.round(navRect.top),
            bottom: Math.round(navRect.bottom),
          }
        : undefined,
      links,
      hamburgerVisible: Boolean(hamburger && hamburger.width > 0 && hamburger.height > 0),
      isDesktop,
    };
  }, viewportName === "desktop");

  if (!navLayout.nav) fail(`${viewportName} nav is missing`);

  if (viewportName === "desktop") {
    if (navLayout.links.length < 5) fail("desktop nav links are not visible", navLayout);
    const overflowingLinks = navLayout.links.filter(
      (link) =>
        link.left < navLayout.nav.left - 1 ||
        link.right > navLayout.nav.right + 1 ||
        link.top < navLayout.nav.top - 1 ||
        link.bottom > navLayout.nav.bottom + 1,
    );
    if (overflowingLinks.length > 0) {
      fail("desktop nav links overflow the navbar", { ...navLayout, overflowingLinks });
    }
  } else if (!navLayout.hamburgerVisible) {
    fail("mobile nav hamburger is not visible", navLayout);
  }
};

const checkSidebar = async (page, viewportName) => {
  const sidebar = await page.evaluate((isDesktop) => {
    const sidebarElement = document.querySelector(".VPSidebar");
    const contentElement =
      document.querySelector(".VPDoc h1") ??
      document.querySelector(".VPDoc .content-container");
    const sidebarRect = sidebarElement?.getBoundingClientRect();
    const contentRect = contentElement?.getBoundingClientRect();
    const styles = sidebarElement ? window.getComputedStyle(sidebarElement) : undefined;

    return {
      display: styles?.display,
      visibility: styles?.visibility,
      sidebar: sidebarRect
        ? {
            left: Math.round(sidebarRect.left),
            right: Math.round(sidebarRect.right),
            width: Math.round(sidebarRect.width),
            height: Math.round(sidebarRect.height),
          }
        : undefined,
      article: contentRect
        ? {
            left: Math.round(contentRect.left),
            right: Math.round(contentRect.right),
          }
        : undefined,
      isDesktop,
    };
  }, viewportName === "desktop");

  if (viewportName === "desktop") {
    if (!sidebar.sidebar || sidebar.sidebar.width < 220 || sidebar.display === "none") {
      fail("desktop sidebar is not visible", sidebar);
    }
    if (sidebar.article && sidebar.article.left < sidebar.sidebar.right - 2) {
      fail("desktop sidebar overlaps document content", sidebar);
    }
  } else if (
    sidebar.sidebar &&
    sidebar.sidebar.width > 0 &&
    sidebar.sidebar.right > 2 &&
    sidebar.display !== "none"
  ) {
    fail("mobile sidebar is visible before opening the menu", sidebar);
  }
};

const checkCodeBlocks = async (page, label) => {
  const codeBlock = page.locator('.vp-doc div[class*="language-"]').first();
  await codeBlock.waitFor({ state: "visible" });

  const colors = await codeBlock.evaluate((block) => {
    const code = block.querySelector("code, .line, pre") ?? block;
    return {
      blockBackground: window.getComputedStyle(block).backgroundColor,
      codeColor: window.getComputedStyle(code).color,
      pageBackground: window.getComputedStyle(document.body).backgroundColor,
    };
  });

  const textContrast = contrastRatio(colors.codeColor, colors.blockBackground);
  const blockContrast = contrastRatio(colors.blockBackground, colors.pageBackground);

  if (textContrast < 4.5) {
    fail(`${label} code text contrast is below WCAG AA`, {
      ...colors,
      contrast: Number(textContrast.toFixed(2)),
    });
  }

  if (blockContrast < 1.25) {
    fail(`${label} code block is not visually separated from the page background`, {
      ...colors,
      contrast: Number(blockContrast.toFixed(2)),
    });
  }
};

const checkTables = async (page, label) => {
  const table = page.locator(".vp-doc table").first();
  await table.waitFor({ state: "visible" });

  const tables = await page.evaluate(() =>
    [...document.querySelectorAll(".vp-doc table")].map((element) => {
      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);
      return {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        overflowX: styles.overflowX,
        viewportWidth: window.innerWidth,
      };
    }),
  );

  const clipped = tables.filter(
    (entry) =>
      entry.left < -2 ||
      entry.right > entry.viewportWidth + 2 ||
      (entry.scrollWidth > entry.clientWidth + 2 &&
        !["auto", "scroll"].includes(entry.overflowX)),
  );

  if (clipped.length > 0) {
    fail(`${label} table layout is clipped or not horizontally scrollable`, clipped);
  }
};

const checkPageTitle = async (page, label) => {
  const title = page.locator(".vp-doc h1").first();
  await title.waitFor({ state: "visible" });
  const text = (await title.textContent())?.trim();
  if (!text) fail(`${label} page title is empty`);
};

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

const pages = [
  {
    name: "quickstart",
    path: "/guide/quickstart",
    checks: [checkPageTitle, checkCodeBlocks],
  },
  {
    name: "spec-method",
    path: "/spec/midnight-method",
    checks: [checkPageTitle, checkTables],
  },
  {
    name: "api-package",
    path: "/packages/api",
    checks: [checkPageTitle],
  },
];

const main = async () => {
  await stat(distRoot);
  await rm(artifactRoot, { force: true, recursive: true });
  await mkdir(artifactRoot, { recursive: true });

  const server = await serveBuiltDocs();
  const browser = await chromium.launch();

  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });

      try {
        for (const target of pages) {
          const url = new URL(
            `${basePath === "/" ? "" : basePath}/${trimSlashes(target.path)}`,
            server.origin,
          );
          await page.goto(url.href, { waitUntil: "domcontentloaded" });
          await page.locator(".VPDoc").waitFor({ state: "visible" });
          await checkNav(page, viewport.name);
          await checkSidebar(page, viewport.name);
          await checkNoPageOverflow(page, `${viewport.name} ${target.name}`);

          for (const check of target.checks) {
            await check(page, `${viewport.name} ${target.name}`);
          }

          const screenshotPath = join(
            artifactRoot,
            `${viewport.name}-${target.name}.png`,
          );
          await page.screenshot({ fullPage: true, path: screenshotPath });
        }
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }

  console.log(
    `docs visual checks passed; screenshots written to ${toPosix(
      relative(repoRoot, artifactRoot),
    )}/`,
  );
};

await main();
