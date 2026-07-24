import ts from "typescript";

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
const IMAGE_EXTENSION_RE = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i;
const IMAGE_FIELD_TOKEN_RE = /^(?:src|image|images|img|photo|photos|poster|thumbnail|thumb|cover|avatar|logo|background)$/i;

function isImageFieldName(name: string): boolean {
  const tokens = name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
  return tokens.some((token) => IMAGE_FIELD_TOKEN_RE.test(token));
}

function isPlaceholderReference(reference: string): boolean {
  const lower = reference.toLowerCase();
  return (
    PLACEHOLDER_HOSTS.some((host) => lower.includes(host)) ||
    /(?:^|[/_.-])(?:placeholder|todo-image|sample-image|dummy-image)(?:[/_.-]|$)/.test(lower)
  );
}

function imageReferences(sourcePath: string, source: string): string[] {
  const references = new Set<string>();
  const sourceFile = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourcePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const bindings = new Map<string, ts.Expression>();
  const fieldName = (node: ts.Node | undefined): string | null => {
    if (!node) return null;
    if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
    return null;
  };
  const addReference = (value: string): void => {
    const reference = value.trim();
    if (isPlaceholderReference(reference) || (reference.startsWith("/images/") && IMAGE_EXTENSION_RE.test(reference))) {
      references.add(reference);
    }
  };
  const resolveExpression = (expression: ts.Expression, seen = new Set<string>()): void => {
    if (ts.isStringLiteralLike(expression)) {
      addReference(expression.text);
      return;
    }
    if (ts.isIdentifier(expression)) {
      if (seen.has(expression.text)) return;
      const initializer = bindings.get(expression.text);
      if (!initializer) return;
      resolveExpression(initializer, new Set([...seen, expression.text]));
      return;
    }
    if (ts.isArrayLiteralExpression(expression)) {
      for (const element of expression.elements) {
        if (ts.isExpression(element)) resolveExpression(element, seen);
      }
      return;
    }
    if (ts.isElementAccessExpression(expression)) {
      if (ts.isIdentifier(expression.expression)) {
        const initializer = bindings.get(expression.expression.text);
        if (initializer && ts.isArrayLiteralExpression(initializer)) {
          const index = expression.argumentExpression;
          if (index && ts.isNumericLiteral(index)) {
            const element = initializer.elements[Number(index.text)];
            if (element && ts.isExpression(element)) resolveExpression(element, seen);
            return;
          }
        }
      }
      resolveExpression(expression.expression, seen);
      return;
    }
    if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
      const initializer = bindings.get(expression.expression.text);
      if (initializer && ts.isObjectLiteralExpression(initializer)) {
        const property = initializer.properties.find(
          (candidate): candidate is ts.PropertyAssignment =>
            ts.isPropertyAssignment(candidate) && fieldName(candidate.name) === expression.name.text,
        );
        if (property) resolveExpression(property.initializer, seen);
      }
      return;
    }
    if (ts.isConditionalExpression(expression)) {
      resolveExpression(expression.whenTrue, seen);
      resolveExpression(expression.whenFalse, seen);
    }
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
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      bindings.set(node.name.text, node.initializer);
    }
    if (ts.isStringLiteralLike(node) && isImageValue(node)) {
      addReference(node.text);
    }
    if (ts.isJsxAttribute(node) && isImageFieldName(node.name.getText(sourceFile)) && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) addReference(node.initializer.text);
      if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        resolveExpression(node.initializer.expression);
      }
    }
    ts.forEachChild(node, visit);
  };
  sourceFile.forEachChild(function collect(node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      bindings.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, collect);
  });
  visit(sourceFile);
  for (const match of source.matchAll(CSS_IMAGE_REFERENCE_RE)) {
    if (match[1]?.trim()) references.add(match[1].trim());
  }
  return [...references];
}

export function pageImageCompletionReason(options: {
  sources: Record<string, string>;
  generatedPaths: string[];
  generationRequired?: boolean;
  allowedRemoteUrls?: string[];
  assetExists(path: string): boolean;
}): string | null {
  const generated = new Set(options.generatedPaths);
  const allowedRemoteUrls = new Set(options.allowedRemoteUrls ?? []);
  const references = new Set<string>();

  for (const [sourcePath, source] of Object.entries(options.sources)) {
    for (const reference of imageReferences(sourcePath, source)) {
      references.add(reference);
      if (allowedRemoteUrls.has(reference)) continue;
      if (isPlaceholderReference(reference)) {
        return `${sourcePath} still uses image placeholder ${reference}. Call generate_image, then replace the placeholder with the returned path.`;
      }
      if (
        reference.startsWith("/images/") &&
        IMAGE_EXTENSION_RE.test(reference) &&
        !generated.has(reference) &&
        !options.assetExists(reference)
      ) {
        return `${sourcePath} references missing image asset ${reference}. Call generate_image and use its returned path.`;
      }
    }
  }

  if (options.generationRequired) {
    if (generated.size === 0) {
      return "An image placeholder was detected in this page session. Call generate_image and use its returned path.";
    }
    if (![...generated].some((path) => references.has(path))) {
      return "A generated image is not referenced by the page source. Patch the source to use the path returned by generate_image.";
    }
  }

  return null;
}
