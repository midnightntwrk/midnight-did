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

const isIdentifierCharacter = (character) =>
  character !== undefined && /[$\w]/u.test(character);

const isWholeWordMatch = (text, index, word) =>
  text.startsWith(word, index) &&
  !isIdentifierCharacter(text[index - 1]) &&
  !isIdentifierCharacter(text[index + word.length]);

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

const skipTemplateLiteral = (text, index) => {
  let nextIndex = index + 1;
  while (nextIndex < text.length) {
    if (text[nextIndex] === "\\") {
      nextIndex += 2;
      continue;
    }
    if (text[nextIndex] === "`") {
      return nextIndex + 1;
    }
    nextIndex += 1;
  }
  return text.length;
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
      const nextIndex = skipTemplateLiteral(text, index);
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
