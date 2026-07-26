import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MaintenanceModeSwitch } from "./AdminSystemSettingsPanel";

describe("MaintenanceModeSwitch", () => {
  it("anchors the thumb on the left when maintenance is disabled", () => {
    const markup = renderToStaticMarkup(
      <MaintenanceModeSwitch maintenance={false} disabled={false} onToggle={() => {}} />
    );

    expect(markup).toContain('aria-checked="false"');
    expect(markup).toContain("left-1");
    expect(markup).toContain("translate-x-0");
  });

  it("moves the anchored thumb to the right when maintenance is enabled", () => {
    const markup = renderToStaticMarkup(
      <MaintenanceModeSwitch maintenance disabled={false} onToggle={() => {}} />
    );

    expect(markup).toContain('aria-checked="true"');
    expect(markup).toContain("left-1");
    expect(markup).toContain("translate-x-6");
  });
});
