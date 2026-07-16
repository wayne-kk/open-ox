import { describe, expect, it, vi } from "vitest";

import {
  DYNAMIC_FAVICON_DISABLED_MEDIA,
  preferOwnedIconLink,
} from "./dynamicFaviconDom";

type FakeLink = HTMLLinkElement & {
  _media: string | null;
  _connected: boolean;
  _removed: boolean;
};

function makeFakeLink(): FakeLink {
  const link = {
    _media: null as string | null,
    _connected: true,
    _removed: false,
    getAttribute(name: string) {
      return name === "media" ? this._media : null;
    },
    setAttribute(name: string, value: string) {
      if (name === "media") this._media = value;
    },
    get isConnected() {
      return this._connected;
    },
    remove() {
      this._removed = true;
      this._connected = false;
    },
  };
  return link as FakeLink;
}

describe("preferOwnedIconLink", () => {
  it("demotes foreign icon links without removing them (React head race)", () => {
    const foreign = makeFakeLink();
    const owned = makeFakeLink();
    const appended: FakeLink[] = [];

    const head = {
      appendChild(node: FakeLink) {
        appended.push(node);
        return node;
      },
    };

    vi.stubGlobal("document", {
      head,
      querySelectorAll() {
        return [foreign, owned];
      },
    });

    preferOwnedIconLink(owned);

    expect(foreign._removed).toBe(false);
    expect(foreign._connected).toBe(true);
    expect(foreign._media).toBe(DYNAMIC_FAVICON_DISABLED_MEDIA);
    expect(owned._removed).toBe(false);
    expect(appended).toEqual([owned]);

    // Simulate React still owning `foreign` and unmounting it — parent exists.
    const parent = {
      removeChild(child: FakeLink) {
        if (!child._connected) {
          throw new TypeError("Cannot read properties of null (reading 'removeChild')");
        }
        child._connected = false;
        return child;
      },
    };
    expect(() => parent.removeChild(foreign)).not.toThrow();

    vi.unstubAllGlobals();
  });
});
