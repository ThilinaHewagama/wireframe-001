// simpleMode.ts for CodeMirror's StreamLanguage

// Base keywords for screen and components (already defined)
const baseComponentKeywords = ["label", "input", "button", "image"];
const screenKeyword = "screen";

// New keywords for stacks and navigation
const stackKeywords = ["vertical_stack", "horizontal_stack"];
const navigationKeywords = ["navigation_stack", "tab_stack", "drawer_stack"];

// All keywords combined for easier regex generation if needed, or individual matching
// const allKeywords = [screenKeyword, ...baseComponentKeywords, ...stackKeywords, ...navigationKeywords];

export const simpleMode = { // Renamed from simpleDslMode to match Editor.tsx import
  start: [
    // String literal
    { regex: /"(?:[^"\\]|\\.)*?"/, token: "string" },

    // Comments
    { regex: /\/\/.*/, token: "comment" },
    { regex: /#.*/, token: "comment" },

    // Screen definition (keyword 'screen' followed by a name)
    // Using 'sol: true' to ensure it's at the start of a line (ignoring leading whitespace)
    { regex: new RegExp(`(?:${screenKeyword})\\b`), token: "keyword", sol: true, next: "screenName" },

    // Stack keywords (vertical_stack, horizontal_stack) followed by {
    // Using 'sol: true' for stacks as they also often start a line of definition or are clearly delimited.
    { regex: new RegExp(`(?:${stackKeywords.join("|")})\\b\\s*\\{`), token: "keyword", sol: true, indent: true },
    // Closing brace for stacks
    { regex: /}\s*$/, token: "keyword", sol: true, dedent: true },


    // Navigation keywords (navigation_stack, tab_stack, drawer_stack)
    // These are usually followed by attributes like root=, tabs=[], drawer=
    // 'def' is often used for definitions or type-like keywords in CodeMirror themes
    { regex: new RegExp(`(?:${navigationKeywords.join("|")})\\b`), token: "def", sol: true },
    // Attributes for navigation (root=, tabs=, drawer=)
    // 'atom' is often used for constants or special values.
    { regex: /(?:root|tabs|drawer)=/, token: "atom" },
    // Values within tabs=[] (screen names, can also be general identifiers)
    // This is a simplified regex; more robust would be to handle brackets and commas in a separate state.
    { regex: /\[[\w\s,-]*\]/, token: "string-2" }, // Using string-2 for array-like values


    // Base component keywords (label, input, button, image)
    // 'variable-2' is a common token type for secondary keywords or properties.
    // These are typically indented, but sol:true is not used here as indentation is semantic, not lexical for highlighting.
    { regex: new RegExp(`(?:${baseComponentKeywords.join("|")})\\b`), token: "variable-2" },

    // Linking operator "->"
    { regex: /->/, token: "operator" },

    // Screen names (often after 'screen' or in links/navigation attributes)
    // This is a general identifier, could also be a property name.
    // 'variable' is a general token for identifiers.
    { regex: /[a-zA-Z_][\w-]*/, token: "variable" },

    // Numbers (if any DSL parameters were numeric, e.g. for spacing - not in current DSL)
    // { regex: /\d+/, token: "number" },

  ],
  screenName: [
      // 'variable-3' can be styled differently for emphasis on screen names.
      { regex: /[a-zA-Z_][\w-]*/, token: "variable-3", next: "start" }, // Screen name token
      { regex: /.*/, token: "error", next: "start"} // Anything else is an error, go back to start
  ],
  // indentation: 2, // This was in a previous version, but StreamLanguage typically doesn't handle it directly.
  // The parser is responsible for semantic indentation. Highlighting just colors tokens.
};

// Exporting dslKeywords might still be useful for other parts of the app, e.g., autocompletion if added later.
export const dslKeywords = [
    screenKeyword,
    ...baseComponentKeywords,
    ...stackKeywords,
    ...navigationKeywords
];
// Also operators or special symbols if needed elsewhere
export const dslOperators = ["->", "{", "}"];

// Ensure the export name matches what Editor.tsx expects: `simpleMode`
// The provided code already uses `export const simpleDslMode`, if Editor.tsx uses `simpleMode`, this needs to be consistent.
// The previous step (Enhance Error Handling) changed Editor.tsx to import `simpleMode`.
// So, the export name here should be `simpleMode`.
// The provided code block in the prompt uses `export const simpleDslMode`. I'm correcting this to `simpleMode`.
