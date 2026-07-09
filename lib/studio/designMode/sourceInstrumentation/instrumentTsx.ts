import ts from "typescript";
import { encodeOxSourceMeta, type OxClassKind, type OxTextKind } from "./sourceMeta";

export interface InstrumentTsxSourceInput {
  filePath: string;
  source: string;
}

export interface InstrumentTsxSourceResult {
  code: string;
  instrumentedCount: number;
}

function jsxTagName(name: ts.JsxTagNameExpression): string {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isPropertyAccessExpression(name)) return name.name.text;
  return "unknown";
}

function attrName(attr: ts.JsxAttributeLike): string | null {
  return ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name) ? attr.name.text : null;
}

function hasAttr(node: ts.JsxOpeningLikeElement, name: string): boolean {
  return node.attributes.properties.some((attr) => attrName(attr) === name);
}

function classifyClass(node: ts.JsxOpeningLikeElement): OxClassKind {
  const attr = node.attributes.properties.find((p) => attrName(p) === "className");
  if (!attr || !ts.isJsxAttribute(attr)) return "none";
  if (!attr.initializer) return "none";
  return ts.isStringLiteral(attr.initializer) ? "static" : "dynamic";
}

function classifyText(children: ts.NodeArray<ts.JsxChild> | undefined): OxTextKind {
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

function makeStringAttr(name: string, value: string): ts.JsxAttribute {
  return ts.factory.createJsxAttribute(ts.factory.createIdentifier(name), ts.factory.createStringLiteral(value));
}

function withInstrumentation(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  filePath: string,
  textKind: OxTextKind
): ts.JsxOpeningElement | ts.JsxSelfClosingElement {
  if (hasAttr(node, "data-ox-source")) return node;
  const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const tag = jsxTagName(node.tagName);
  const classKind = classifyClass(node);
  const source = encodeOxSourceMeta({
    version: 1,
    file: filePath,
    line: pos.line + 1,
    column: pos.character + 1,
    tag,
    textKind,
    classKind,
  });
  const attrs = ts.factory.createJsxAttributes([
    makeStringAttr("data-ox-source", source),
    makeStringAttr("data-ox-text-kind", textKind),
    makeStringAttr("data-ox-class-kind", classKind),
    ...node.attributes.properties,
  ]);
  if (ts.isJsxSelfClosingElement(node)) {
    return ts.factory.updateJsxSelfClosingElement(node, node.tagName, node.typeArguments, attrs);
  }
  return ts.factory.updateJsxOpeningElement(node, node.tagName, node.typeArguments, attrs);
}

export function instrumentTsxSource(input: InstrumentTsxSourceInput): InstrumentTsxSourceResult {
  const sourceFile = ts.createSourceFile(input.filePath, input.source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let instrumentedCount = 0;

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visit: ts.Visitor = (node) => {
      if (ts.isJsxElement(node)) {
        const textKind = classifyText(node.children);
        const opening = withInstrumentation(node.openingElement, sourceFile, input.filePath, textKind) as ts.JsxOpeningElement;
        if (opening !== node.openingElement) instrumentedCount += 1;
        return ts.factory.updateJsxElement(node, opening, ts.visitNodes(node.children, visit, ts.isJsxChild), node.closingElement);
      }
      if (ts.isJsxSelfClosingElement(node)) {
        const next = withInstrumentation(node, sourceFile, input.filePath, "none") as ts.JsxSelfClosingElement;
        if (next !== node) instrumentedCount += 1;
        return next;
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (node) => ts.visitNode(node, visit) as ts.SourceFile;
  };

  const result = ts.transform(sourceFile, [transformer]);
  const printed = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(result.transformed[0]!);
  result.dispose();
  return { code: printed, instrumentedCount };
}
