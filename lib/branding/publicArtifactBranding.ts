import fs from "fs/promises";
import path from "path";

const BRANDING_BLOCK_START = "<!-- OPEN_OX_BRANDING_START -->";
const BRANDING_BLOCK_END = "<!-- OPEN_OX_BRANDING_END -->";
const EXISTING_BRANDING_BLOCK =
  /<!-- OPEN_OX_BRANDING_START -->[\s\S]*?<!-- OPEN_OX_BRANDING_END -->/g;

export type PublicArtifactBrandingOptions = {
  removeBranding: boolean;
  projectToken: string;
  appUrl: string;
  publicChannel?: "publish_preview" | "vercel_deploy";
};

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function badgeMarkup(options: PublicArtifactBrandingOptions): string {
  const destination = new URL("/", options.appUrl);
  destination.searchParams.set("utm_source", "made_with_open_ox");
  destination.searchParams.set("utm_medium", "referral");
  destination.searchParams.set("utm_campaign", "published_project");
  destination.searchParams.set("utm_content", options.projectToken);
  destination.searchParams.set("create", "1");
  const href = escapeAttribute(destination.toString());
  const eventsUrl = escapeAttribute(
    new URL("/api/branding/events", options.appUrl).toString(),
  );
  const projectToken = escapeAttribute(options.projectToken);
  const publicChannel = escapeAttribute(options.publicChannel ?? "publish_preview");

  return `${BRANDING_BLOCK_START}
<div data-open-ox-branding="v1" data-project-token="${projectToken}" data-public-channel="${publicChannel}" data-events-url="${eventsUrl}" class="ox-branding" role="group" aria-label="Open OX branding">
  <a class="ox-branding__link" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="Made with Open OX (opens in a new tab)">
    <span class="ox-branding__mark" aria-hidden="true">OX</span><span class="ox-branding__text">Made with Open OX</span>
  </a>
  <button class="ox-branding__collapse" type="button" aria-label="Collapse Made with Open OX">&#215;</button>
</div>
<style data-open-ox-branding-style="v1">
.ox-branding{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:2147483000;display:flex;align-items:center;gap:2px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:12px;line-height:1;color:#161616;filter:drop-shadow(0 2px 8px rgb(0 0 0/.18))}
.ox-branding__link,.ox-branding__collapse{height:32px;border:1px solid rgb(0 0 0/.13);background:#fff;color:inherit}.ox-branding__link{display:flex;align-items:center;gap:7px;padding:0 10px;border-radius:6px 2px 2px 6px;text-decoration:none}.ox-branding__mark{display:grid;place-items:center;width:20px;height:20px;border-radius:4px;background:#151515;color:#fff;font-size:9px;font-weight:750}.ox-branding__collapse{width:28px;padding:0;border-radius:2px 6px 6px 2px;cursor:pointer;font-size:16px}.ox-branding a:focus-visible,.ox-branding button:focus-visible{outline:2px solid #1677ff;outline-offset:2px}.ox-branding[data-collapsed="true"] .ox-branding__text,.ox-branding[data-collapsed="true"] .ox-branding__collapse{display:none}.ox-branding[data-collapsed="true"] .ox-branding__link{width:32px;padding:0;justify-content:center;border-radius:6px}.ox-branding[data-collapsed="true"] .ox-branding__mark{width:20px}
@media(max-width:640px){.ox-branding{right:max(8px,env(safe-area-inset-right));bottom:max(8px,env(safe-area-inset-bottom));font-size:11px}.ox-branding__link,.ox-branding__collapse{height:30px}.ox-branding__link{padding:0 8px}}
@media(prefers-reduced-motion:reduce){.ox-branding *{scroll-behavior:auto!important;transition:none!important}}
</style>
<script data-open-ox-branding-script="v1">(()=>{const root=document.querySelector('[data-open-ox-branding="v1"]');if(!root)return;const session=globalThis.crypto?.randomUUID?.()||String(Date.now());const emit=(kind)=>{try{navigator.sendBeacon(root.dataset.eventsUrl,new Blob([JSON.stringify({kind,projectToken:root.dataset.projectToken,session,viewportClass:matchMedia('(max-width: 640px)').matches?'mobile':'desktop',publicChannel:root.dataset.publicChannel})],{type:'text/plain'}))}catch{}};emit('impression');root.querySelector('.ox-branding__collapse')?.addEventListener('click',()=>{root.dataset.collapsed='true';emit('collapse')});root.querySelector('.ox-branding__link')?.addEventListener('click',()=>emit('click'))})();</script>
${BRANDING_BLOCK_END}`;
}

async function htmlFiles(root: string, current = root): Promise<string[]> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) return htmlFiles(root, full);
      return entry.isFile() && entry.name.endsWith(".html") ? [full] : [];
    }),
  );
  return nested.flat();
}

export async function applyPublicArtifactBranding(
  outDir: string,
  options: PublicArtifactBrandingOptions,
): Promise<void> {
  const injection = options.removeBranding ? "" : badgeMarkup(options);
  const files = await htmlFiles(outDir);
  await Promise.all(
    files.map(async (file) => {
      const original = await fs.readFile(file, "utf8");
      const clean = original.replace(EXISTING_BRANDING_BLOCK, "");
      const next = injection
        ? clean.includes("</body>")
          ? clean.replace("</body>", `${injection}</body>`)
          : `${clean}${injection}`
        : clean;
      if (next !== original) await fs.writeFile(file, next, "utf8");
    }),
  );
}
