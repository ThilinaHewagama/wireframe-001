// Define new interfaces for stacks
export interface BasicComponent {
  type: 'label' | 'input' | 'button' | 'image';
  text?: string;
  placeholder?: string;
  src?: string;
  lineNumber: number;
}

export interface Stack {
  type: 'vertical_stack' | 'horizontal_stack';
  components: DslElement[];
  lineNumber: number;
}

export type DslElement = BasicComponent | Stack;

export interface Screen {
  name: string;
  components: DslElement[];
  lineNumber: number;
}

export type NavigationConfig =
  | { type: 'navigation_stack'; root: string; lineNumber: number; }
  | { type: 'tab_stack'; tabs: string[]; lineNumber: number; }
  | { type: 'drawer_stack'; root: string; drawer: string; lineNumber: number; };

export interface ScreenLink {
  sourceScreenName: string;
  destinationScreenName: string;
  lineNumber: number;
}

export interface ParseError {
  lineNumber: number;
  message: string;
}

export interface ParseResult {
  screens: Screen[];
  navigationStacks: NavigationConfig[];
  links: ScreenLink[];
  errors: ParseError[];
}

// Regex patterns
const screenRegex = /^screen\s+([\w-]+)\s*$/i;
const labelRegex = /^label\s+"([^"]*)"\s*$/i;
const inputRegex = /^input(?:\s+placeholder="([^"]*)")?\s*$/i;
const buttonRegex = /^button\s+"([^"]*)"\s*$/i;
const imageRegex = /^image\s+src="([^"]*)"\s*$/i;

const verticalStackStartRegex = /^vertical_stack\s*{\s*$/i;
const horizontalStackStartRegex = /^horizontal_stack\s*{\s*$/i;
const stackEndRegex = /^}\s*$/i;

const navigationStackRegex = /^navigation_stack\s+root=([\w-]+)\s*$/i;
const tabStackRegex = /^tab_stack\s+tabs=\[([\w\s,-]+)\]\s*$/i;
const drawerStackRegex = /^drawer_stack\s+root=([\w-]+)\s+drawer=([\w-]+)\s*$/i;

const screenLinkRegex = /^([\w-]+)\s*->\s*([\w-]+)\s*$/i;

const emptyLineRegex = /^\s*$/;
const commentRegex = /^\s*(\/\/|#).*/;

const countIndentation = (line: string): number => {
  return line.match(/^\s*/)?.[0].length || 0;
};

export const parseDsl = (code: string): ParseResult => {
  const lines = code.split('\n');
  const result: ParseResult = {
    screens: [],
    navigationStacks: [] as NavigationConfig[],
    links: [],
    errors: [],
  };

  const contextStack: Array<{ container: Screen | Stack; baseIndent: number }> = [];
  let lineNumber = 0;

  for (const rawLine of lines) {
    lineNumber++;
    const line = rawLine.trimEnd();

    if (emptyLineRegex.test(line) || commentRegex.test(line)) {
      continue;
    }

    const currentIndent = countIndentation(line);
    const lineContent = line.trimStart();

    // Pop context if current line's indentation means we've exited a block,
    // or if it's a closing brace for the current stack.
    let poppedForBrace = false;
    while (contextStack.length > 0) {
      const currentContext = contextStack[contextStack.length - 1];
      if (currentContext.container.type !== 'screen' && stackEndRegex.test(lineContent) && currentIndent === currentContext.baseIndent) {
        contextStack.pop();
        poppedForBrace = true; // Mark that a pop happened due to a correctly placed brace
        // Continue, as this brace might close multiple nested stacks if they share the same closing line and indent
      } else if (currentIndent <= currentContext.baseIndent && currentContext.container.type !== 'screen') {
        contextStack.pop(); // Popped due to de-indentation
        poppedForBrace = false; // Reset flag if pop was due to de-indent
      } else {
        break; // Current context is still valid
      }
    }

    // If the line's sole purpose was to close a stack (or multiple stacks), and it did, then continue.
    if (poppedForBrace && stackEndRegex.test(lineContent)) {
        continue;
    }

    const activeContext = contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;
    const expectedComponentIndent = activeContext ? activeContext.baseIndent + 2 : 0;
    let match;

    if (!activeContext && currentIndent === 0) {
      // Top-level definitions
      if ((match = navigationStackRegex.exec(lineContent))) {
        if (result.navigationStacks.length > 0) { // Simplified check: any nav config means conflict
             result.errors.push({ lineNumber, message: 'Multiple global navigation configurations are not allowed. Define only one (e.g., navigation_stack OR tab_stack OR drawer_stack).' });
        } else {
            result.navigationStacks.push({ type: 'navigation_stack', root: match[1], lineNumber });
        }
        continue;
      }
      if ((match = tabStackRegex.exec(lineContent))) {
         if (result.navigationStacks.length > 0) {
            result.errors.push({ lineNumber, message: 'Multiple global navigation configurations are not allowed. Define only one (e.g., navigation_stack OR tab_stack OR drawer_stack).' });
        } else {
            const tabs = match[1].split(',').map(t => t.trim()).filter(t => t.length > 0);
            if (tabs.length === 0) {
                result.errors.push({ lineNumber, message: 'tab_stack must define at least one tab screen name.' });
            } else {
                result.navigationStacks.push({ type: 'tab_stack', tabs, lineNumber });
            }
        }
        continue;
      }
      if ((match = drawerStackRegex.exec(lineContent))) {
         if (result.navigationStacks.length > 0) {
            result.errors.push({ lineNumber, message: 'Multiple global navigation configurations are not allowed. Define only one (e.g., navigation_stack OR tab_stack OR drawer_stack).' });
        } else {
            result.navigationStacks.push({ type: 'drawer_stack', root: match[1], drawer: match[2], lineNumber });
        }
        continue;
      }
      if ((match = screenLinkRegex.exec(lineContent))) {
        result.links.push({ sourceScreenName: match[1], destinationScreenName: match[2], lineNumber});
        continue;
      }
      if ((match = screenRegex.exec(lineContent))) {
        if (result.screens.find(s => s.name === match![1])) {
          result.errors.push({ lineNumber, message: `Duplicate screen name: ${match[1]}` });
        }
        const newScreen: Screen = { name: match[1], components: [], lineNumber };
        result.screens.push(newScreen);
        contextStack.push({ container: newScreen, baseIndent: currentIndent });
        continue;
      }
    }

    if (!activeContext) {
        if (! (screenRegex.test(lineContent) || navigationStackRegex.test(lineContent) || tabStackRegex.test(lineContent) || drawerStackRegex.test(lineContent) || screenLinkRegex.test(lineContent)) ) {
            result.errors.push({ lineNumber, message: `Unexpected content at top level: "${lineContent}"` });
        }
        continue;
    }

    // Inside a context (screen or stack)
    // Misplaced closing brace for a stack (wrong indentation)
    if (activeContext.container.type !== 'screen' && stackEndRegex.test(lineContent) && currentIndent !== activeContext.baseIndent) {
        result.errors.push({ lineNumber, message: `Misplaced closing brace '}' for stack. Expected at indent ${activeContext.baseIndent}, found at ${currentIndent}.` });
        continue;
    }
    // If it was a correctly placed closing brace, the `poppedForBrace` logic at the top should have handled it.

    if (currentIndent < expectedComponentIndent) {
        result.errors.push({ lineNumber, message: `Incorrect indentation. Expected at least ${expectedComponentIndent} spaces for content within '${activeContext.container.type}'. Found ${currentIndent} spaces.` });
        continue;
    }

    if (currentIndent >= expectedComponentIndent) {
        if ((match = verticalStackStartRegex.exec(lineContent))) {
            const newStack: Stack = { type: 'vertical_stack', components: [], lineNumber };
            (activeContext.container.components as DslElement[]).push(newStack);
            contextStack.push({ container: newStack, baseIndent: currentIndent });
            continue;
        }
        if ((match = horizontalStackStartRegex.exec(lineContent))) {
            const newStack: Stack = { type: 'horizontal_stack', components: [], lineNumber };
            (activeContext.container.components as DslElement[]).push(newStack);
            contextStack.push({ container: newStack, baseIndent: currentIndent });
            continue;
        }

        if (activeContext.container.type === 'screen' || activeContext.container.type === 'vertical_stack' || activeContext.container.type === 'horizontal_stack') {
            let component: BasicComponent | null = null;
            if ((match = labelRegex.exec(lineContent))) { component = { type: 'label', text: match[1], lineNumber }; }
            else if ((match = inputRegex.exec(lineContent))) { component = { type: 'input', placeholder: match[1] || '', lineNumber };}
            else if ((match = buttonRegex.exec(lineContent))) { component = { type: 'button', text: match[1], lineNumber }; }
            else if ((match = imageRegex.exec(lineContent))) {
                const src = match[1];
                if (!src.match(/^(https|http|ftp):\/\//i) && !src.match(/^\/[^\/]/i) && !src.match(/^[\w-]+\.(png|jpg|jpeg|gif|svg)$/i)) {
                    // Simplified error message for image src
                    result.errors.push({ lineNumber, message: `Invalid image src: "${src}".` });
                }
                component = { type: 'image', src: src, lineNumber };
            }

            if (component) {
                (activeContext.container.components as DslElement[]).push(component);
                continue;
            }
        }
    }

    // Fallback error for otherwise unhandled lines within a context
    // Check if it's an extraneous closing brace not caught by specific mis-indented check
    if (stackEndRegex.test(lineContent)) {
        result.errors.push({ lineNumber, message: `Extraneous or misplaced closing brace '}'.` });
    } else {
        result.errors.push({ lineNumber, message: `Invalid syntax or misplaced content within '${activeContext.container.type}': "${lineContent}"` });
    }
  }

  // Final check for unclosed blocks (stacks)
  if (contextStack.some(ctx => ctx.container.type !== 'screen')) {
    // Find the innermost unclosed stack to report
    const innermostUnclosedStack = contextStack.slice().reverse().find(ctx => ctx.container.type !== 'screen');
    if (innermostUnclosedStack) {
        result.errors.push({
            lineNumber: innermostUnclosedStack.container.lineNumber,
            message: `Unclosed ${innermostUnclosedStack.container.type.replace('_', ' ')} block started on this line (missing '}'?).`
        });
    }
  }

  // Post-parsing validation for screen links
  const screenNames = new Set(result.screens.map(s => s.name));
  result.links.forEach(link => {
    if (!screenNames.has(link.sourceScreenName)) {
      result.errors.push({ lineNumber: link.lineNumber, message: `Source screen "${link.sourceScreenName}" in link not defined.` });
    }
    if (!screenNames.has(link.destinationScreenName)) {
      result.errors.push({ lineNumber: link.lineNumber, message: `Destination screen "${link.destinationScreenName}" in link not defined.` });
    }
  });

  return result;
};
