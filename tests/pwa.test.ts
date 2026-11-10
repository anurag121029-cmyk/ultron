import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf-8");

describe("PWA manifest", () => {
  it("exists and names ULTRON as a standalone app", () => {
    const manifest = JSON.parse(read("public/manifest.webmanifest"));
    expect(manifest.name).toBe("ULTRON");
    expect(manifest.short_name).toBe("ULTRON");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.theme_color).toBe("#05070d");
    expect(manifest.background_color).toBe("#05070d");
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(manifest.icons.some((i: { purpose?: string }) => (i.purpose ?? "").includes("maskable"))).toBe(true);
  });

  it("every icon listed in the manifest exists on disk", () => {
    const manifest = JSON.parse(read("public/manifest.webmanifest"));
    for (const icon of manifest.icons as Array<{ src: string }>) {
      expect(existsSync(join(root, "public", icon.src.replace(/^\//, "")))).toBe(true);
    }
    expect(existsSync(join(root, "public/apple-touch-icon.png"))).toBe(true);
    expect(existsSync(join(root, "public/favicon.png"))).toBe(true);
  });

  it("icon PNGs are real PNGs at the declared sizes", async () => {
    for (const [file, size] of [["public/icon-192.png", 192], ["public/icon-512.png", 512], ["public/apple-touch-icon.png", 180]] as const) {
      const meta = await sharp(join(root, file)).metadata();
      expect(meta.format).toBe("png");
      expect(meta.width).toBe(size);
      expect(meta.height).toBe(size);
    }
  });
});

describe("service worker", () => {
  it("exists, caches the shell, and never caches /api/*", () => {
    const sw = read("public/sw.js");
    expect(sw).toContain("ultron-shell-v1");
    expect(sw).toContain('"/"');
    expect(sw).toContain("/api/");
    // API requests must pass through to the network, not be served from cache.
    expect(sw).toMatch(/pathname\.startsWith\("\/api\/"\)/);
    expect(sw).not.toMatch(/cache\.put.*\/api/);
  });
});

describe("layout wires up the PWA", () => {
  it("links the manifest, sets theme colour and Apple touch icon", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toContain('manifest: "/manifest.webmanifest"');
    expect(layout).toContain('themeColor: "#05070d"');
    expect(layout).toContain('viewportFit: "cover"');
    expect(layout).toContain("apple-touch-icon.png");
    expect(layout).toContain("appleWebApp");
    expect(layout).toContain("PwaRegister");
  });

  it("the home page renders the install component", () => {
    const page = read("app/page.tsx");
    expect(page).toContain("InstallApp");
    expect(page).toContain("<InstallApp />");
  });
});
