import ts from "typescript";
import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import type { FileSessionCompletionContext } from "@/ai/shared/fileSession/fileSession";
import type { PageArtifactRequirement } from "@/ai/flows/generate_project/pageBuildSession/pageBuildSession";

const PLACEHOLDER_HOSTS = [
  "picsum.photos",
  "images.unsplash.com",
  "source.unsplash.com",
  "placehold.co",
  "placeholder.com",
  "via.placeholder.com",
  "dummyimage.com",
];

const CSS_IMAGE_REFERENCE_RE = /url\(\s*["']?([^"')\s}]+)(?:["']?\s*\))/g;
const CSS_IMAGE_SET_RE = /(?:-webkit-)?image-set\(([^)]*)\)/gi;
const CSS_IMAGE_SET_CANDIDATE_RE = /["']([^"']+)["']\s+(?:\d+(?:\.\d+)?x|\d+w)\b/g;
const CSS_IMAGE_SYNTAX_RE = /(?:url|image-set)\s*\(/i;
const IMAGE_FIELD_TOKEN_RE = /^(?:src|srcset|image|images|img|photo|photos|poster|thumbnail|thumb|cover|avatar|logo|background)$/i;

function isImageFieldName(name: string): boolean {
  const tokens = name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
  return tokens.some((token) => IMAGE_FIELD_TOKEN_RE.test(token));
}

function remoteUrlOf(reference: string): URL | null {
  try {
    const url = new URL(reference.startsWith("//") ? `https:${reference}` : reference);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function isPlaceholderReference(reference: string): boolean {
  const lower = reference.toLowerCase();
  const hostname = remoteUrlOf(reference)?.hostname.toLowerCase() ?? null;
  return (
    (hostname !== null && PLACEHOLDER_HOSTS.includes(hostname)) ||
    /(?:^|[/_.-])(?:placeholder|todo-image|sample-image|dummy-image)(?:[/_.-]|$)/.test(lower)
  );
}

function isSafePublicImageReference(reference: string): boolean {
  if (!reference.startsWith("/images/")) return true;
  const path = reference.split(/[?#]/, 1)[0];
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return false;
  }
  return !decoded.split(/[\\/]+/).some((segment) => segment === "..");
}

function inspectImageReferences(
  sourcePath: string,
  source: string,
): { references: string[]; sinkReferences: string[]; unverifiable: string[] } {
  const references = new Set<string>();
  const sinkReferences = new Set<string>();
  const unverifiable = new Set<string>();
  const sourceFile = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourcePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const bindings = new Map<string, ts.VariableDeclaration[]>();
  const fieldName = (node: ts.Node | undefined): string | null => {
    if (!node) return null;
    if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
    return null;
  };
  const addReference = (value: string, sink = false): void => {
    const reference = value.trim();
    const cssReferences = [...reference.matchAll(CSS_IMAGE_REFERENCE_RE)];
    const imageSetReferences = [...reference.matchAll(CSS_IMAGE_SET_RE)].flatMap((imageSet) =>
      [...(imageSet[1] ?? "").matchAll(CSS_IMAGE_SET_CANDIDATE_RE)].map(
        (candidate) => candidate[1],
      ),
    );
    if (cssReferences.length > 0 || imageSetReferences.length > 0) {
      for (const candidate of [
        ...cssReferences.map((match) => match[1]),
        ...imageSetReferences,
      ]) {
        if (candidate) addReference(candidate, sink);
      }
      return;
    }
    const isRemote = remoteUrlOf(reference) !== null;
    if (isRemote || isPlaceholderReference(reference) || reference.startsWith("/images/")) {
      references.add(reference);
      if (sink) sinkReferences.add(reference);
    }
  };
  const scopeOf = (node: ts.Node): ts.Node => {
    let current: ts.Node | undefined = node.parent;
    while (current && !ts.isSourceFile(current) && !ts.isFunctionLike(current) && !ts.isBlock(current)) {
      current = current.parent;
    }
    return current ?? sourceFile;
  };
  const bindingInitializer = (identifier: ts.Identifier): ts.Expression | null => {
    const candidates = bindings.get(identifier.text) ?? [];
    const visibleScopes: ts.Node[] = [];
    let current: ts.Node | undefined = identifier;
    while (current) {
      if (ts.isSourceFile(current) || ts.isFunctionLike(current) || ts.isBlock(current)) {
        visibleScopes.push(current);
      }
      current = current.parent;
    }
    const declaration = candidates
      .filter((candidate) => candidate.getStart(sourceFile) < identifier.getStart(sourceFile))
      .map((candidate) => ({ candidate, depth: visibleScopes.indexOf(scopeOf(candidate)) }))
      .filter(({ depth }) => depth >= 0)
      .sort((left, right) => left.depth - right.depth || right.candidate.pos - left.candidate.pos)[0]
      ?.candidate;
    return declaration?.initializer ?? null;
  };
  const resolveExpression = (
    expression: ts.Expression,
    addValue: (value: string) => void = addReference,
    seen = new Set<string>(),
  ): boolean => {
    if (ts.isStringLiteralLike(expression)) {
      addValue(expression.text);
      return true;
    }
    if (ts.isTemplateExpression(expression)) {
      const staticParts =
        expression.head.text + expression.templateSpans.map((span) => span.literal.text).join("");
      if (isPlaceholderReference(staticParts)) addValue(staticParts);
      return false;
    }
    if (ts.isIdentifier(expression)) {
      const bindingKey = `${expression.text}:${expression.pos}`;
      if (seen.has(bindingKey)) return false;
      const initializer = bindingInitializer(expression);
      if (!initializer) return false;
      return resolveExpression(initializer, addValue, new Set([...seen, bindingKey]));
    }
    if (ts.isArrayLiteralExpression(expression)) {
      return expression.elements.every(
        (element) => ts.isExpression(element) && resolveExpression(element, addValue, seen),
      );
    }
    if (ts.isElementAccessExpression(expression)) {
      if (ts.isIdentifier(expression.expression)) {
        const initializer = bindingInitializer(expression.expression);
        if (initializer && ts.isArrayLiteralExpression(initializer)) {
          const index = expression.argumentExpression;
          if (index && ts.isNumericLiteral(index)) {
            const element = initializer.elements[Number(index.text)];
            if (element && ts.isExpression(element)) {
              return resolveExpression(element, addValue, seen);
            }
            return false;
          }
        }
      }
      return resolveExpression(expression.expression, addValue, seen);
    }
    if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
      const initializer = bindingInitializer(expression.expression);
      if (initializer && ts.isObjectLiteralExpression(initializer)) {
        const property = initializer.properties.find(
          (candidate): candidate is ts.PropertyAssignment =>
            ts.isPropertyAssignment(candidate) && fieldName(candidate.name) === expression.name.text,
        );
        if (property) return resolveExpression(property.initializer, addValue, seen);
      }
      return false;
    }
    if (ts.isConditionalExpression(expression)) {
      return (
        resolveExpression(expression.whenTrue, addValue, seen) &&
        resolveExpression(expression.whenFalse, addValue, seen)
      );
    }
    return false;
  };
  const isImageValue = (node: ts.StringLiteralLike): boolean => {
    const parent = node.parent;
    if (ts.isJsxAttribute(parent)) {
      return isImageFieldName(parent.name.getText(sourceFile));
    }
    if (ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent)) {
      return isImageFieldName(parent.parent.name.getText(sourceFile));
    }
    if (ts.isPropertyAssignment(parent)) {
      return isImageFieldName(fieldName(parent.name) ?? "");
    }
    if (ts.isVariableDeclaration(parent)) {
      return isImageFieldName(fieldName(parent.name) ?? "");
    }
    if (ts.isArrayLiteralExpression(parent)) {
      const owner = parent.parent;
      if (ts.isVariableDeclaration(owner)) return isImageFieldName(fieldName(owner.name) ?? "");
      if (ts.isPropertyAssignment(owner)) return isImageFieldName(fieldName(owner.name) ?? "");
    }
    return false;
  };
  const jsxAttributeAncestor = (node: ts.Node): ts.JsxAttribute | null => {
    let current: ts.Node | undefined = node.parent;
    while (current && !ts.isStatement(current) && !ts.isSourceFile(current)) {
      if (ts.isJsxAttribute(current)) return current;
      current = current.parent;
    }
    return null;
  };
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) && isImageValue(node)) {
      const attribute = jsxAttributeAncestor(node);
      addReference(
        node.text,
        attribute?.name.getText(sourceFile).toLowerCase() === "style",
      );
    }
    if (ts.isJsxAttribute(node) && /^(?:class|classname)$/i.test(node.name.getText(sourceFile))) {
      if (node.initializer && ts.isStringLiteral(node.initializer)) {
        addReference(node.initializer.text, true);
      }
      if (
        node.initializer &&
        ts.isJsxExpression(node.initializer) &&
        node.initializer.expression &&
        CSS_IMAGE_SYNTAX_RE.test(node.initializer.expression.getText(sourceFile))
      ) {
        const resolved = resolveExpression(
          node.initializer.expression,
          (value) => addReference(value, true),
        );
        if (!resolved) unverifiable.add(node.initializer.expression.getText(sourceFile));
      }
    }
    if (ts.isJsxAttribute(node) && isImageFieldName(node.name.getText(sourceFile)) && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) {
        const value = node.initializer.text;
        if (node.name.getText(sourceFile).toLowerCase() === "srcset") {
          for (const candidate of value.split(",")) {
            addReference(candidate.trim().split(/\s+/, 1)[0] ?? "", true);
          }
        } else {
          addReference(value, true);
        }
      }
      if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        const isSrcSet = node.name.getText(sourceFile).toLowerCase() === "srcset";
        const resolved = resolveExpression(
          node.initializer.expression,
          isSrcSet
            ? (value) => {
                for (const candidate of value.split(",")) {
                  addReference(candidate.trim().split(/\s+/, 1)[0] ?? "", true);
                }
              }
            : (value) => addReference(value, true),
        );
        if (!resolved) unverifiable.add(node.initializer.expression.getText(sourceFile));
      }
    }
    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      ts.isJsxElement(node.parent) &&
      node.parent.openingElement.tagName.getText(sourceFile).toLowerCase() === "style" &&
      CSS_IMAGE_SYNTAX_RE.test(node.expression.getText(sourceFile))
    ) {
      const resolved = resolveExpression(node.expression, (value) => addReference(value, true));
      if (!resolved) unverifiable.add(node.expression.getText(sourceFile));
    }
    if (ts.isTaggedTemplateExpression(node)) {
      const tag = node.tag.getText(sourceFile).toLowerCase();
      if (
        (tag === "css" || tag.startsWith("styled")) &&
        CSS_IMAGE_SYNTAX_RE.test(node.template.getText(sourceFile))
      ) {
        const resolved = resolveExpression(node.template, (value) => addReference(value, true));
        if (!resolved) unverifiable.add(node.template.getText(sourceFile));
      }
    }
    ts.forEachChild(node, visit);
  };
  sourceFile.forEachChild(function collect(node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      bindings.set(node.name.text, [...(bindings.get(node.name.text) ?? []), node]);
    }
    ts.forEachChild(node, collect);
  });
  visit(sourceFile);
  if (/\.css$/i.test(sourcePath)) {
    const cssWithoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
    addReference(cssWithoutComments, true);
  }
  return {
    references: [...references],
    sinkReferences: [...sinkReferences],
    unverifiable: [...unverifiable],
  };
}

interface PageImageInspectionOptions {
  sources: Record<string, string>;
  generatedPaths: string[];
  allowedRemoteUrls?: string[];
  assetExists(path: string): boolean;
}

interface PageImageRequirementResult {
  requirement: PageArtifactRequirement;
  reason: string;
}

function inspectPageImageRequirements(options: PageImageInspectionOptions): PageImageRequirementResult[] {
  const generated = new Set(options.generatedPaths);
  const allowedRemoteUrls = new Set(options.allowedRemoteUrls ?? []);
  const references = new Set<string>();
  const sinkReferences = new Set<string>();
  const results: PageImageRequirementResult[] = [];
  const pendingAssetViolations: Array<{
    path: string;
    reference: string;
    reason: string;
  }> = [];
  const pendingDiagnostics: PageImageRequirementResult[] = [];
  const assetRequirement = (
    path: string,
    reference: string,
    reason: string,
    nextAction: "generate_asset" | "edit_source",
    replacement?: string,
  ): PageImageRequirementResult => ({
    requirement: {
      kind: "asset_reference",
      path,
      reference,
      nextAction,
      ...(replacement ? { replacement } : {}),
    },
    reason,
  });

  for (const [sourcePath, source] of Object.entries(options.sources)) {
    const inspection = inspectImageReferences(sourcePath, source);
    for (const reference of inspection.sinkReferences) sinkReferences.add(reference);
    for (const reference of inspection.references) {
      references.add(reference);
      if (allowedRemoteUrls.has(reference)) continue;
      if (!isSafePublicImageReference(reference)) {
        pendingAssetViolations.push({ path: sourcePath, reference, reason: `${sourcePath} uses invalid image asset path ${reference}. Image assets must remain under /images/.` });
        continue;
      }
      if (isPlaceholderReference(reference)) {
        pendingAssetViolations.push({ path: sourcePath, reference, reason: `${sourcePath} still uses image placeholder ${reference}. Call generate_image, then replace the placeholder with the returned path.` });
        continue;
      }
      const remoteUrl = remoteUrlOf(reference);
      if (remoteUrl) {
        pendingAssetViolations.push({ path: sourcePath, reference, reason: `${sourcePath} uses remote image ${reference}, which is not a user-provided URL. Call generate_image and use its returned path.` });
        continue;
      }
      if (
        reference.startsWith("/images/") &&
        !generated.has(reference) &&
        !options.assetExists(reference)
      ) {
        pendingAssetViolations.push({ path: sourcePath, reference, reason: `${sourcePath} references missing image asset ${reference}. Call generate_image and use its returned path.` });
      }
    }
    if (inspection.unverifiable.length > 0) {
      const message = `${sourcePath} contains an image source that cannot be verified statically: ${inspection.unverifiable[0]}. Use a literal path returned by generate_image.`;
      pendingDiagnostics.push({
        requirement: { kind: "source_diagnostic", path: sourcePath, message },
        reason: message,
      });
    }
  }

  const unconsumed = [...generated].filter((path) => !sinkReferences.has(path));
  for (const [index, violation] of pendingAssetViolations.entries()) {
    results.push(assetRequirement(
      violation.path,
      violation.reference,
      violation.reason,
      index < unconsumed.length ? "edit_source" : "generate_asset",
      unconsumed[index],
    ));
  }
  results.push(...pendingDiagnostics);
  if (unconsumed.length > 0 && results.length === 0) {
    const sourcePath = Object.keys(options.sources)[0] ?? "app/page.tsx";
    results.push({
      requirement: {
        kind: "asset_reference",
        path: sourcePath,
        reference: unconsumed[0],
        nextAction: "edit_source",
        replacement: unconsumed[0],
      },
      reason: `Generated image ${unconsumed[0]} is not referenced by the current page revision. Patch the source to use the path returned by generate_image.`,
    });
  }

  return results;
}

export function pageImageArtifactRequirements(
  options: PageImageInspectionOptions,
): readonly PageArtifactRequirement[] {
  return inspectPageImageRequirements(options).map((result) => result.requirement);
}

export function pageImageCompletionReason(options: PageImageInspectionOptions): string | null {
  return inspectPageImageRequirements(options)[0]?.reason ?? null;
}

export interface PageImageAssetSession {
  recordGeneratedAsset(path: string): void;
  generatedPaths(): string[];
  validateCompletion(context: FileSessionCompletionContext): string | null;
  inspect(artifacts: FileSessionCompletionContext["artifacts"]): readonly PageArtifactRequirement[];
}

export function createPageImageAssetSession(options: {
  allowedRemoteUrls?: string[];
  assetExists(path: string): boolean;
}): PageImageAssetSession {
  const generatedPaths = new Set<string>();
  const inspectionOptions = (artifacts: FileSessionCompletionContext["artifacts"]): PageImageInspectionOptions => ({
    sources: Object.fromEntries(
      [...artifacts.entries()].map(([path, artifact]) => [path, artifact.content]),
    ),
    generatedPaths: [...generatedPaths],
    allowedRemoteUrls: options.allowedRemoteUrls,
    assetExists: options.assetExists,
  });
  return {
    recordGeneratedAsset: (path) => generatedPaths.add(path),
    generatedPaths: () => [...generatedPaths],
    validateCompletion: ({ artifacts }) => pageImageCompletionReason(inspectionOptions(artifacts)),
    inspect: (artifacts) => pageImageArtifactRequirements(inspectionOptions(artifacts)),
  };
}

export function createPublicImageAssetExists(siteRoot: string): (path: string) => boolean {
  const imageRoot = resolve(siteRoot, "public/images");
  return (publicPath) => {
    if (!isSafePublicImageReference(publicPath) || !publicPath.startsWith("/images/")) return false;
    const pathname = publicPath.split(/[?#]/, 1)[0];
    const absolutePath = resolve(siteRoot, `public${pathname}`);
    if (absolutePath !== imageRoot && !absolutePath.startsWith(`${imageRoot}${sep}`)) return false;
    return existsSync(absolutePath);
  };
}
