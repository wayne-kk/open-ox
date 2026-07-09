const path = require("node:path");
const ts = require("typescript");

function toBase64Url(value) {
  return Buffer.from(value, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encode(meta) {
  return toBase64Url(JSON.stringify(meta));
}

function jsxTagName(name) {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isPropertyAccessExpression(name)) return name.name.text;
  return "unknown";
}

function attrName(attr) {
  return ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name) ? attr.name.text : null;
}

function hasAttr(node, name) {
  return node.attributes.properties.some((attr) => attrName(attr) === name);
}

function classifyClass(node) {
  const attr = node.attributes.properties.find((p) => attrName(p) === "className");
  if (!attr || !ts.isJsxAttribute(attr) || !attr.initializer) return "none";
  return ts.isStringLiteral(attr.initializer) ? "static" : "dynamic";
}

function classifyText(children) {
  if (!children || children.length === 0) return "none";
  let hasStatic = false;
  let hasDynamic = false;
  for (const child of children) {
    if (ts.isJsxText(child) && child.getText().replace(/\s+/g, "").length > 0) hasStatic = true;
    else if (ts.isJsxExpression(child)) hasDynamic = true;
    else if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)) hasDynamic = true;
  }
  if (hasStatic && hasDynamic) return "mixed";
  if (hasDynamic) return "dynamic";
  if (hasStatic) return "static";
  return "none";
}

function makeAttr(name, value) {
  return ts.factory.createJsxAttribute(ts.factory.createIdentifier(name), ts.factory.createStringLiteral(value));
}

module.exports = function sourceInstrumentationLoader(source) {
  const callback = this.async();
  const root = this.rootContext || process.cwd();
  const rel = path.relative(root, this.resourcePath).replace(/\\/g, "/");
  const sourceFile = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let changed = false;

  function withAttrs(node, textKind) {
    if (hasAttr(node, "data-ox-source")) return node;
    const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const tag = jsxTagName(node.tagName);
    const classKind = classifyClass(node);
    const meta = encode({
      version: 1,
      file: rel,
      line: pos.line + 1,
      column: pos.character + 1,
      tag,
      textKind,
      classKind,
    });
    const attrs = ts.factory.createJsxAttributes([
      makeAttr("data-ox-source", meta),
      makeAttr("data-ox-text-kind", textKind),
      makeAttr("data-ox-class-kind", classKind),
      ...node.attributes.properties,
    ]);
    changed = true;
    if (ts.isJsxSelfClosingElement(node)) return ts.factory.updateJsxSelfClosingElement(node, node.tagName, node.typeArguments, attrs);
    return ts.factory.updateJsxOpeningElement(node, node.tagName, node.typeArguments, attrs);
  }

  const transformer = (context) => {
    const visit = (node) => {
      if (ts.isJsxElement(node)) {
        const opening = withAttrs(node.openingElement, classifyText(node.children));
        return ts.factory.updateJsxElement(node, opening, ts.visitNodes(node.children, visit, ts.isJsxChild), node.closingElement);
      }
      if (ts.isJsxSelfClosingElement(node)) return withAttrs(node, "none");
      return ts.visitEachChild(node, visit, context);
    };
    return (node) => ts.visitNode(node, visit);
  };

  const result = ts.transform(sourceFile, [transformer]);
  const code = changed ? ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(result.transformed[0]) : source;
  result.dispose();
  callback(null, code);
};
