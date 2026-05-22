const API_PRODUCTION_SOURCE_ROOT = "packages/api/src/";

export const apiUnknownCastAllowed = new Set([
  // The Compact compiled contract constructor is not expressible through the
  // published SDK type surface yet. Keep this escape hatch review-visible.
  "packages/api/src/contract-instance.ts",
]);

export const isApiProductionSource = (filePath) =>
  filePath.startsWith(API_PRODUCTION_SOURCE_ROOT) &&
  filePath.endsWith(".ts") &&
  !filePath.includes("/test/");

const skipLineComment = (text, index) => {
  let nextIndex = index + 2;
  while (nextIndex < text.length && text[nextIndex] !== "\n") {
    nextIndex += 1;
  }
  return nextIndex;
};

const skipBlockComment = (text, index) => {
  let nextIndex = index + 2;
  while (nextIndex < text.length) {
    if (text[nextIndex] === "*" && text[nextIndex + 1] === "/") {
      return nextIndex + 2;
    }
    nextIndex += 1;
  }
  return text.length;
};

const skipQuotedString = (text, index, quote) => {
  let nextIndex = index + 1;
  while (nextIndex < text.length) {
    if (text[nextIndex] === "\\") {
      nextIndex += 2;
      continue;
    }
    if (text[nextIndex] === quote) {
      return nextIndex + 1;
    }
    nextIndex += 1;
  }
  return text.length;
};

const readTemplateExpression = (text, index) => {
  const startIndex = index;
  let depth = 1;
  let nextIndex = index;

  while (nextIndex < text.length) {
    const character = text[nextIndex];
    const nextCharacter = text[nextIndex + 1];

    if (character === "/" && nextCharacter === "/") {
      nextIndex = skipLineComment(text, nextIndex);
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      nextIndex = skipBlockComment(text, nextIndex);
      continue;
    }

    if (character === "\"" || character === "'") {
      nextIndex = skipQuotedString(text, nextIndex, character);
      continue;
    }

    if (character === "`") {
      const template = maskTemplateLiteral(text, nextIndex);
      nextIndex = template.nextIndex;
      continue;
    }

    if (character === "{") {
      depth += 1;
      nextIndex += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          expression: text.slice(startIndex, nextIndex),
          nextIndex: nextIndex + 1,
        };
      }
    }

    nextIndex += 1;
  }

  return {
    expression: text.slice(startIndex),
    nextIndex: text.length,
  };
};

function maskTemplateLiteral(text, index) {
  let output = " ";
  let nextIndex = index + 1;

  while (nextIndex < text.length) {
    const character = text[nextIndex];
    const nextCharacter = text[nextIndex + 1];

    if (character === "\\") {
      output += "  ";
      nextIndex += 2;
      continue;
    }

    if (character === "`") {
      output += " ";
      return { output, nextIndex: nextIndex + 1 };
    }

    if (character === "$" && nextCharacter === "{") {
      const expression = readTemplateExpression(text, nextIndex + 2);
      output += "  ";
      output += stripCommentsAndStrings(expression.expression);
      output += " ";
      nextIndex = expression.nextIndex;
      continue;
    }

    output += character === "\n" ? "\n" : " ";
    nextIndex += 1;
  }

  return { output, nextIndex: text.length };
}

const skipRegexLiteral = (text, index) => {
  let nextIndex = index + 1;
  let inCharacterClass = false;

  while (nextIndex < text.length) {
    const character = text[nextIndex];
    if (character === "\\") {
      nextIndex += 2;
      continue;
    }
    if (character === "[") {
      inCharacterClass = true;
      nextIndex += 1;
      continue;
    }
    if (character === "]") {
      inCharacterClass = false;
      nextIndex += 1;
      continue;
    }
    if (character === "/" && !inCharacterClass) {
      nextIndex += 1;
      while (/[a-z]/iu.test(text[nextIndex] ?? "")) {
        nextIndex += 1;
      }
      return nextIndex;
    }
    nextIndex += 1;
  }

  return text.length;
};

const REGEX_PREFIX_PATTERN = /(?:^|[({[=,:;!&|?+\-*~^<>]\s*)$/u;

const startsRegexLiteral = (text, index) => {
  const prefix = text.slice(Math.max(0, index - 32), index);
  return REGEX_PREFIX_PATTERN.test(prefix);
};

export const stripCommentsAndStrings = (text) => {
  let output = "";
  let index = 0;

  while (index < text.length) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === "/" && nextCharacter === "/") {
      const nextIndex = skipLineComment(text, index);
      output += " ".repeat(nextIndex - index);
      index = nextIndex;
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      const nextIndex = skipBlockComment(text, index);
      output += " ".repeat(nextIndex - index);
      index = nextIndex;
      continue;
    }

    if (character === "\"" || character === "'") {
      const nextIndex = skipQuotedString(text, index, character);
      output += " ".repeat(nextIndex - index);
      index = nextIndex;
      continue;
    }

    if (character === "`") {
      const template = maskTemplateLiteral(text, index);
      output += template.output;
      index = template.nextIndex;
      continue;
    }

    if (character === "/" && startsRegexLiteral(text, index)) {
      const nextIndex = skipRegexLiteral(text, index);
      output += " ".repeat(nextIndex - index);
      index = nextIndex;
      continue;
    }

    output += character;
    index += 1;
  }

  return output;
};

const hasAsAnyCast = (sourceText) => /\bas\s+any\b/u.test(sourceText);

const hasDoubleUnknownCast = (sourceText) =>
  /\bas\s+unknown\s+as\b/u.test(sourceText);

export const productionCastViolationsForSource = (
  filePath,
  sourceText,
  { unknownCastAllowed = apiUnknownCastAllowed } = {},
) => {
  const searchableSource = stripCommentsAndStrings(sourceText);
  const violations = [];

  if (hasAsAnyCast(searchableSource)) {
    violations.push(
      `${filePath} production API source must not use \`as any\` casts`,
    );
  }

  if (
    !unknownCastAllowed.has(filePath) &&
    hasDoubleUnknownCast(searchableSource)
  ) {
    violations.push(
      `${filePath} production API source must not use \`as unknown as\` casts`,
    );
  }

  return violations;
};

export const findProductionCastViolations = (
  sourcePaths,
  readText,
  options = {},
) =>
  sourcePaths
    .filter(isApiProductionSource)
    .flatMap((sourcePath) =>
      productionCastViolationsForSource(
        sourcePath,
        readText(sourcePath),
        options,
      ),
    );
