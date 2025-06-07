// StringStream import removed

// This is the mode definition object itself, now named simpleMode.
export const simpleMode = {
  token: (stream: any) => { // Changed StringStream to any, or could be more specific if a base type is known
    if (stream.match(/screen|label|input|button|image/)) {
      return 'keyword';
    }
    if (stream.match(/"(?:[^"\\]|\\.)*"/)) {
      return 'string';
    }
    if (stream.match(/[a-zA-Z_][\w_]*/)) {
      return 'variable'; // Identifiers like screen names or other text
    }
    // Skip whitespace or other characters
    stream.next();
    return null;
  },
};

// Export dslKeywords if anything needs them, though simpleMode above is self-contained for tokenization
export const dslKeywords = ["screen", "label", "input", "button", "image"];
