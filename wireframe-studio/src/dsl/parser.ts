export interface Component {
  type: 'label' | 'input' | 'button' | 'image';
  text?: string; // For label, button
  placeholder?: string; // For input
  src?: string; // For image
  lineNumber: number; // To help with error reporting
}

export interface Screen {
  name: string;
  components: Component[];
  lineNumber: number; // Line where screen definition starts
}

export interface ParseError {
  lineNumber: number;
  message: string;
}

export interface ParseResult {
  screens: Screen[];
  errors: ParseError[];
}

// Regex patterns
const screenRegex = /^screen\s+([\w-]+)\s*$/i;
const labelRegex = /^\s*label\s+"([^"]*)"\s*$/i;
const inputRegex = /^\s*input(?:\s+placeholder="([^"]*)")?\s*$/i;
const buttonRegex = /^\s*button\s+"([^"]*)"\s*$/i;
const imageRegex = /^\s*image\s+src="([^"]*)"\s*$/i;
const emptyLineRegex = /^\s*$/;

export const parseDsl = (code: string): ParseResult => {
  const lines = code.split('\n');
  const screens: Screen[] = [];
  const errors: ParseError[] = [];
  let currentScreen: Screen | null = null;
  let lineNumber = 0;

  for (const rawLine of lines) {
    lineNumber++;
    const line = rawLine.trimEnd(); // Keep leading spaces for component indentation check

    if (emptyLineRegex.test(line)) {
      continue; // Skip empty lines
    }

    let match;

    match = screenRegex.exec(line);
    if (match) {
      if (currentScreen && currentScreen.components.length === 0 && screens.find(s => s.name === currentScreen?.name)) {
        // If previous screen was empty and it's a duplicate name, it might be a typo, let's remove it
        // This is a simple heuristic
        const existingScreenIndex = screens.findIndex(s => s.name === currentScreen?.name);
        if (existingScreenIndex > -1 && screens[existingScreenIndex].components.length === 0) {
            screens.splice(existingScreenIndex, 1);
        }
      }
      currentScreen = { name: match[1], components: [], lineNumber };
      // Check for duplicate screen names
      if (screens.find(s => s.name === currentScreen?.name)) {
        errors.push({ lineNumber, message: `Duplicate screen name: ${currentScreen.name}` });
        // To avoid issues, we can either stop processing this screen or rename it internally
        // For now, we'll allow it but log an error. The renderer can decide how to handle it.
      }
      screens.push(currentScreen);
      continue;
    }

    if (!currentScreen) {
      if (!emptyLineRegex.test(line)) { // Only error if it's not an empty line
        errors.push({ lineNumber, message: "Component definition outside of a screen block." });
      }
      continue;
    }

    // Components must be indented
    if (line.startsWith('  ') === false) {
        errors.push({ lineNumber, message: "Component definition must be indented (e.g., with two spaces)." });
        continue;
    }

    const componentLine = line.trimStart(); // Now trim leading space for regex matching

    match = labelRegex.exec(componentLine);
    if (match) {
      currentScreen.components.push({ type: 'label', text: match[1], lineNumber });
      continue;
    }

    match = inputRegex.exec(componentLine);
    if (match) {
      currentScreen.components.push({ type: 'input', placeholder: match[1] || '', lineNumber });
      continue;
    }

    match = buttonRegex.exec(componentLine);
    if (match) {
      currentScreen.components.push({ type: 'button', text: match[1], lineNumber });
      continue;
    }

    match = imageRegex.exec(componentLine);
    if (match) {
      // Basic URL sanitization (very simple, consider a library for robust XSS protection)
      const src = match[1];
      if (!src.match(/^(https|http|ftp):\/\//i) && !src.match(/^\/[^\/]/i) && !src.match(/^[\w-]+\.(png|jpg|jpeg|gif|svg)$/i)) {
         errors.push({ lineNumber, message: `Invalid image src: "${src}". Must be a valid URL, an absolute path, or a local file name.` });
      }
      currentScreen.components.push({ type: 'image', src: src, lineNumber });
      continue;
    }

    errors.push({ lineNumber, message: `Invalid syntax: "${rawLine.trim()}"` });
  }

  // Filter out screens that were added but had errors making them invalid (e.g. duplicate name that we decide to fully discard)
  // For now, we keep all screens and let errors be handled/displayed by the UI

  return { screens, errors };
};
