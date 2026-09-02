import { theme } from './theme';

/**
 * A deliberately small tokenizer. Shiki or Prism would look better, but they are a
 * dependency and a build step for a video that shows twenty lines at a time — this
 * is thirty lines and covers what the examples actually contain.
 */
const KEYWORDS = new Set([
  // TypeScript
  'const', 'let', 'var', 'function', 'return', 'import', 'from', 'export', 'type',
  'interface', 'async', 'await', 'try', 'catch', 'throw', 'new', 'if', 'else', 'for',
  'while', 'class', 'extends', 'implements', 'true', 'false', 'null', 'undefined', 'void',
  // Python
  'def', 'lambda', 'raise', 'except', 'global', 'None', 'True', 'False', 'not', 'and',
  'or', 'in', 'is', 'elif', 'with', 'as', 'pass', 'yield',
]);

export type Token = { text: string; color: string };

const PATTERN = new RegExp(
  [
    '(#[^\\n]*|//[^\\n]*)', // comment
    '("""[\\s\\S]*?"""|\'[^\']*\'|"[^"]*"|`[^`]*`)', // string
    '(\\b\\d+(?:\\.\\d+)?\\b)', // number
    '([A-Za-z_$][\\w$]*)', // identifier
    '(\\s+)', // whitespace
    '([^\\s\\w$]+)', // punctuation
  ].join('|'),
  'g',
);

export function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  for (const match of code.matchAll(PATTERN)) {
    const [text, comment, string, number, identifier, whitespace] = match;
    if (comment) tokens.push({ text, color: theme.syntax.comment });
    else if (string) tokens.push({ text, color: theme.syntax.string });
    else if (number) tokens.push({ text, color: theme.syntax.number });
    else if (identifier) {
      const isCall = code[match.index + text.length] === '(';
      tokens.push({
        text,
        color: KEYWORDS.has(text)
          ? theme.syntax.keyword
          : isCall
            ? theme.syntax.fn
            : theme.syntax.plain,
      });
    } else if (whitespace) tokens.push({ text, color: theme.syntax.plain });
    else tokens.push({ text, color: theme.syntax.plain });
  }
  return tokens;
}
