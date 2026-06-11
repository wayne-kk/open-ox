import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult } from "@/ai/tools/types";
import type {
  UserProvidedBusiness,
  UserProvidedContent,
  UserProvidedImage,
  UserProvidedLink,
  UserProvidedTestimonial,
} from "../types";
import { normalizeUserProvidedContent } from "../schema/normalizeUserProvidedContent";

export type UserProvidedContentAccumulator = {
  business: Partial<UserProvidedBusiness>;
  images: UserProvidedImage[];
  testimonials: UserProvidedTestimonial[];
  hours: string[];
  menuItems: string[];
  palette: string[];
  links: UserProvidedLink[];
  notes?: string;
};

export function createUserProvidedContentAccumulator(): UserProvidedContentAccumulator {
  return {
    business: {},
    images: [],
    testimonials: [],
    hours: [],
    menuItems: [],
    palette: [],
    links: [],
  };
}

export function buildContentFromAccumulator(
  acc: UserProvidedContentAccumulator
): UserProvidedContent | undefined {
  return normalizeUserProvidedContent({
    business: Object.values(acc.business).some(Boolean) ? acc.business : undefined,
    hours: acc.hours.length ? acc.hours : undefined,
    menuItems: acc.menuItems.length ? acc.menuItems : undefined,
    palette: acc.palette.length ? acc.palette : undefined,
    testimonials: acc.testimonials.length ? acc.testimonials : undefined,
    images: acc.images.length ? acc.images : undefined,
    links: acc.links.length ? acc.links : undefined,
    notes: acc.notes,
  });
}

function trimStr(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t.length > 0 ? t : undefined;
}

export const setUserProvidedBusinessTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "set_user_provided_business",
    description:
      "Set business facts the user explicitly provided (name, street address, phone, website, etc.). Call once when business block is present.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        address: {
          type: "string",
          description:
            "Full street address for map embed (e.g. 2457 N Milwaukee Ave, Chicago, IL 60647). Not phone or website.",
        },
        phone: { type: "string" },
        website: { type: "string", description: "Business homepage URL only" },
        rating: { type: "string" },
        reviewCount: { type: "string" },
      },
    },
  },
};

function composeImageUrl(args: Record<string, unknown>): string | undefined {
  const full = trimStr(args.url);
  if (full && /^https?:\/\//i.test(full)) return full;

  const prefix = trimStr(args.url_prefix);
  const suffix = trimStr(args.url_suffix);
  if (prefix && suffix && /^https?:\/\//i.test(prefix) && suffix.startsWith("=")) {
    return `${prefix}${suffix}`;
  }
  return undefined;
}

export const addUserProvidedImageTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "add_user_provided_image",
    description:
      "Register ONE image URL from the user message. For long Google URLs, pass url_prefix + url_suffix (=s4800-w1200) instead of one url field.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Complete https URL when it fits in one string",
        },
        url_prefix: {
          type: "string",
          description: "Start of URL through path, before =s… suffix (Google CDN)",
        },
        url_suffix: {
          type: "string",
          description: "Size suffix e.g. =s4800-w1200 — append to url_prefix",
        },
        caption: { type: "string" },
        role: { type: "string", description: "e.g. hero, gallery, exterior" },
      },
    },
  },
};

export const addUserProvidedTestimonialTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "add_user_provided_testimonial",
    description: "Add one verbatim customer quote from the user message.",
    parameters: {
      type: "object",
      properties: {
        quote: { type: "string" },
        author: { type: "string" },
        stars: { type: "number" },
        relativeTime: { type: "string" },
      },
      required: ["quote"],
    },
  },
};

export const addUserProvidedMenuItemTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "add_user_provided_menu_item",
    description: "Add one menu item or highlight the user listed.",
    parameters: {
      type: "object",
      properties: {
        item: { type: "string" },
      },
      required: ["item"],
    },
  },
};

export const addUserProvidedHoursLineTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "add_user_provided_hours_line",
    description: "Add one hours line (e.g. Tuesday: 5:00 PM – 2:00 AM).",
    parameters: {
      type: "object",
      properties: {
        line: { type: "string" },
      },
      required: ["line"],
    },
  },
};

export const addUserProvidedPaletteSwatchTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "add_user_provided_palette_swatch",
    description: "Add one color swatch the user specified.",
    parameters: {
      type: "object",
      properties: {
        swatch: { type: "string" },
      },
      required: ["swatch"],
    },
  },
};

export const addUserProvidedLinkTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "add_user_provided_link",
    description: "Add a link the user provided (reservation, menu PDF, social, etc.).",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string" },
        label: { type: "string" },
      },
      required: ["url"],
    },
  },
};

export const setUserProvidedNotesTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "set_user_provided_notes",
    description: "Free-form constraints or notes the user emphasized.",
    parameters: {
      type: "object",
      properties: {
        notes: { type: "string" },
      },
      required: ["notes"],
    },
  },
};

export const userProvidedFactsExtractionTools: ChatCompletionTool[] = [
  setUserProvidedBusinessTool,
  addUserProvidedTestimonialTool,
  addUserProvidedMenuItemTool,
  addUserProvidedHoursLineTool,
  addUserProvidedPaletteSwatchTool,
  addUserProvidedLinkTool,
  setUserProvidedNotesTool,
];

export const userProvidedContentExtractionTools: ChatCompletionTool[] = [
  ...userProvidedFactsExtractionTools,
  addUserProvidedImageTool,
];

export function createUserProvidedContentToolExecutors(
  acc: UserProvidedContentAccumulator
): Record<string, (args: Record<string, unknown>) => Promise<ToolResult | string>> {
  return {
    set_user_provided_business: async (args) => {
      const fields: (keyof UserProvidedBusiness)[] = [
        "name",
        "description",
        "address",
        "phone",
        "website",
        "rating",
        "reviewCount",
      ];
      for (const key of fields) {
        const v = trimStr(args[key]);
        if (v) acc.business[key] = v;
      }
      return { success: true, output: "business facts recorded" };
    },
    add_user_provided_image: async (args) => {
      const url = composeImageUrl(args);
      if (!url) {
        return {
          success: false,
          error: "provide url OR url_prefix + url_suffix for the full https link",
        };
      }
      const caption = trimStr(args.caption);
      const role = trimStr(args.role);
      const existing = acc.images.find((img) => img.url === url);
      if (existing) {
        if (caption) existing.caption = caption;
        if (role) existing.role = role;
        return {
          success: true,
          output: `image already recorded (#${acc.images.indexOf(existing) + 1}); metadata updated if provided`,
        };
      }
      acc.images.push({
        url,
        caption,
        role,
      });
      console.log(
        `[extract_user_provided_content] image #${acc.images.length} (${url.length} chars)\n  url: ${url}`
      );
      return { success: true, output: `image #${acc.images.length} recorded (${url.length} chars)` };
    },
    add_user_provided_testimonial: async (args) => {
      const quote = trimStr(args.quote);
      if (!quote) return { success: false, error: "quote required" };
      acc.testimonials.push({
        quote,
        author: trimStr(args.author),
        stars:
          typeof args.stars === "number" || typeof args.stars === "string"
            ? args.stars
            : undefined,
        relativeTime: trimStr(args.relativeTime),
      });
      return { success: true, output: "testimonial recorded" };
    },
    add_user_provided_menu_item: async (args) => {
      const item = trimStr(args.item);
      if (!item) return { success: false, error: "item required" };
      acc.menuItems.push(item);
      return { success: true, output: "menu item recorded" };
    },
    add_user_provided_hours_line: async (args) => {
      const line = trimStr(args.line);
      if (!line) return { success: false, error: "line required" };
      acc.hours.push(line);
      return { success: true, output: "hours line recorded" };
    },
    add_user_provided_palette_swatch: async (args) => {
      const swatch = trimStr(args.swatch);
      if (!swatch) return { success: false, error: "swatch required" };
      acc.palette.push(swatch);
      return { success: true, output: "palette swatch recorded" };
    },
    add_user_provided_link: async (args) => {
      const url = trimStr(args.url);
      if (!url || !/^https?:\/\//i.test(url)) {
        return { success: false, error: "url must be https" };
      }
      acc.links.push({ url, label: trimStr(args.label) });
      return { success: true, output: "link recorded" };
    },
    set_user_provided_notes: async (args) => {
      const notes = trimStr(args.notes);
      if (!notes) return { success: false, error: "notes required" };
      acc.notes = notes;
      return { success: true, output: "notes recorded" };
    },
  };
}
