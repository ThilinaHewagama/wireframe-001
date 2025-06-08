import { StringStream, StreamParser } from '@codemirror/language';

// Define the state for our simple mode
interface DslModeState {
  // True if the next token is expected to be a screen name after 'screen' keyword
  inScreenNameContext: boolean;
  // Potentially add more state flags if mode becomes more complex, e.g., for nested blocks
  // currentIndent: number; // If we were to manage complex indentation states
}

export const simpleMode: StreamParser<DslModeState> = {
  startState: (): DslModeState => {
    return {
      inScreenNameContext: false,
      // currentIndent: 0,
    };
  },

  token: (stream: StringStream, state: DslModeState): string | null => {
    // Handle comments first (match whole line)
    if (stream.match(/\/\/.*/, true, true)) return 'comment'; // Consume line, case-insensitive for match
    if (stream.match(/#.*/, true, true)) return 'comment';   // Consume line, case-insensitive for match

    // Whitespace: skip it. If a line is entirely whitespace, stream.eol() will be true.
    if (stream.eatSpace()) return null;

    // Handle strings (match until closing quote, handling escapes)
    if (stream.match(/"(?:[^"\\]|\\.)*?"/)) return 'string';

    // Check if we are expecting a screen name
    if (state.inScreenNameContext) {
      state.inScreenNameContext = false; // Consume this context
      if (stream.match(/[a-zA-Z_][\w-]*/)) {
        return 'variable-3'; // Screen name token
      }
      // If not a valid screen name right after 'screen', it's an error or unstyled.
      // Let other rules attempt to match or return null.
    }

    // Keywords and Operators
    // Order can be important here. More specific or longer matches often come first.

    if (stream.match(/->/)) return 'operator';

    // Use \b for word boundaries to avoid matching parts of longer words.
    if (stream.match(/screen\b/)) {
      state.inScreenNameContext = true;
      return 'keyword';
    }

    // Stacks: match "keyword {" or "}"
    if (stream.match(/(vertical_stack|horizontal_stack)\b\s*{/)) {
      // state.currentIndent++; // Example if managing indent state for highlighting
      return 'keyword';
    }
    if (stream.match(/}/)) {
      // state.currentIndent = Math.max(0, state.currentIndent - 1);
      return 'keyword'; // Closing brace
    }

    // Navigation keywords
    if (stream.match(/(navigation_stack|tab_stack|drawer_stack)\b/)) return 'def';
    // Navigation attributes
    if (stream.match(/(root=|tabs=|drawer=)/)) return 'atom';

    // Simplified matching for content inside tabs=[...].
    // This is basic and might not perfectly handle all cases or nested structures within.
    if (stream.match(/\[\s*([a-zA-Z_][\w-]*(\s*,\s*[a-zA-Z_][\w-]*)*)\s*]/)) {
        return 'string-2'; // Style for array-like values or list of screen names
    }

    // Base component keywords
    const componentKeywords = ["label", "input", "button", "image"];
    for (const kw of componentKeywords) {
      // Match keyword only if it's a whole word
      if (stream.match(new RegExp(kw + '\\b'))) return 'variable-2';
    }

    // General identifiers (e.g., screen names in links, attribute values if not otherwise tokenized)
    if (stream.match(/[a-zA-Z_][\w-]*/)) return 'variable';

    // If nothing matched, advance the stream by one character to avoid infinite loops
    // and return null (no specific token type for this character).
    stream.next();
    return null;
  },

  // Optional: Add 'indent' function if you want CodeMirror to auto-indent based on syntax.
  // This requires importing `IndentContext` and `indentUnit` from `@codemirror/language`.
  // Example:
  // indent: (state: DslModeState, textAfter: string, context: IndentContext): number | null => {
  //   if (textAfter.match(/^\s*}/)) { // Line is '}' or starts with '}' after whitespace
  //     return context.baseIndent - context.unit; // Dedent
  //   }
  //   // Add more sophisticated logic based on state (e.g., if last token was '{')
  //   // if (state.lastTokenWasOpenBrace) return context.baseIndent + context.unit;
  //   return null; // Means no change or rely on CodeMirror's default behavior
  // }
};

// Exporting dslKeywords might still be useful for other parts of the app
export const dslKeywords = [
    "screen", "label", "input", "button", "image",
    "vertical_stack", "horizontal_stack",
    "navigation_stack", "tab_stack", "drawer_stack"
];
export const dslOperators = ["->", "{", "}"];
