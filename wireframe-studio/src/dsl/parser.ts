// Define new interfaces for stacks
export interface BasicComponent {
  type: 'label' | 'input' | 'button' | 'image';
  text?: string;
  placeholder?: string;
  src?: string;
  lineNumber: number;
}

export interface Stack {
  kind: 'stack'; // Discriminant
  type: 'vertical_stack' | 'horizontal_stack'; // Specific stack type
  components: DslElement[];
  lineNumber: number;
}

export type DslElement = BasicComponent | Stack;

export interface Screen {
  kind: 'screen'; // Discriminant
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
    let poppedForBraceThisLine = false;

    if (emptyLineRegex.test(line) || commentRegex.test(line)) {
      continue;
    }

    const currentIndent = countIndentation(line);
    const lineContent = line.trimStart();

    // Pop contexts based on indentation or closing brace
    while (contextStack.length > 0) {
      const currentContext = contextStack[contextStack.length - 1];
      if (currentContext.container.kind === 'stack' && stackEndRegex.test(lineContent) && currentIndent === currentContext.baseIndent) {
        contextStack.pop();
        poppedForBraceThisLine = true;
        // Continue checking if this brace also closes parent stacks at the same indent
      } else if (currentContext.container.kind === 'stack' && currentIndent <= currentContext.baseIndent) {
        contextStack.pop();
        poppedForBraceThisLine = false; // De-indent is not a brace consumption
      } else {
        poppedForBraceThisLine = false; // Reset if no pop happened for this context
        break;
      }
    }

    // If the line was fully consumed by closing one or more braces (and contains nothing else)
    if (poppedForBraceThisLine && lineContent.replace(stackEndRegex, '').trim() === '') {
        continue;
    }
    // If it popped for brace but there's trailing content, it's an error that will be caught later.

    const activeContext = contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;
    const expectedComponentIndent = activeContext ? activeContext.baseIndent + 2 : 0;
    let match: RegExpExecArray | null;

    if (!activeContext && currentIndent === 0) {
      // Top-level definitions
      if ((match = navigationStackRegex.exec(lineContent))) {
        if (result.navigationStacks.length > 0) {
             result.errors.push({ lineNumber, message: 'Multiple global navigation configurations are not allowed. Define only one type (e.g., navigation_stack OR tab_stack OR drawer_stack).' });
        } else {
            result.navigationStacks.push({ type: 'navigation_stack', root: match[1], lineNumber });
        }
        continue;
      }
      if ((match = tabStackRegex.exec(lineContent))) {
         if (result.navigationStacks.length > 0) {
            result.errors.push({ lineNumber, message: 'Multiple global navigation configurations are not allowed. Define only one type.' });
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
            result.errors.push({ lineNumber, message: 'Multiple global navigation configurations are not allowed. Define only one type.' });
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
        const newScreen: Screen = { kind: 'screen', name: match[1], components: [], lineNumber };
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
    if (activeContext.container.kind === 'stack' && stackEndRegex.test(lineContent) && currentIndent !== activeContext.baseIndent) {
        result.errors.push({ lineNumber, message: `Misplaced closing brace '}' for stack. Expected at indent ${activeContext.baseIndent}, found at ${currentIndent}.` });
        continue;
    }
    // If it's a closing brace at the correct indent, poppedForBraceThisLine should have made us 'continue' already if line was only '}'

    if (currentIndent < expectedComponentIndent) {
        // Only an error if it's not a closing brace that was already handled (or should have been)
        if (!stackEndRegex.test(lineContent)) { // Avoid redundant error if it's a brace that will be caught as extraneous
             result.errors.push({ lineNumber, message: `Incorrect indentation. Expected at least ${expectedComponentIndent} spaces for content within '${activeContext.container.kind === 'stack' ? activeContext.container.type : activeContext.container.kind}'. Found ${currentIndent} spaces.` });
        }
        continue;
    }

    if (currentIndent >= expectedComponentIndent) {
        if ((match = verticalStackStartRegex.exec(lineContent))) {
            const newStack: Stack = { kind: 'stack', type: 'vertical_stack', components: [], lineNumber };
            activeContext.container.components.push(newStack);
            contextStack.push({ container: newStack, baseIndent: currentIndent });
            continue;
        }
        if ((match = horizontalStackStartRegex.exec(lineContent))) {
            const newStack: Stack = { kind: 'stack', type: 'horizontal_stack', components: [], lineNumber };
            activeContext.container.components.push(newStack);
            contextStack.push({ container: newStack, baseIndent: currentIndent });
            continue;
        }

        if (activeContext.container.kind === 'screen' || activeContext.container.kind === 'stack') {
            let component: BasicComponent | null = null;
            if ((match = labelRegex.exec(lineContent))) { component = { type: 'label', text: match[1], lineNumber }; }
            else if ((match = inputRegex.exec(lineContent))) { component = { type: 'input', placeholder: match[1] || '', lineNumber };}
            else if ((match = buttonRegex.exec(lineContent))) { component = { type: 'button', text: match[1], lineNumber }; }
            else if ((match = imageRegex.exec(lineContent))) {
                const src = match[1];
                if (!src.match(/^(https|http|ftp):\/\//i) && !src.match(/^\/[^\/]/i) && !src.match(/^[\w-]+\.(png|jpg|jpeg|gif|svg)$/i)) {
                    result.errors.push({ lineNumber, message: `Invalid image src: "${src}".` });
                }
                component = { type: 'image', src: src, lineNumber };
            }

            if (component) {
                activeContext.container.components.push(component);
                continue;
            }
        }
    }

    // Fallback error if no other rule matched
    if (stackEndRegex.test(lineContent)) { // If it's a brace but wasn't handled by pop or specific mis-indent error
        result.errors.push({ lineNumber, message: `Extraneous or misplaced closing brace '}'.` });
    } else {
        result.errors.push({ lineNumber, message: `Invalid syntax or misplaced content within '${activeContext.container.kind === 'stack' ? activeContext.container.type : activeContext.container.kind}': "${lineContent}"` });
    }
  }

  // Final check for unclosed blocks
  if (contextStack.length > 0) {
    const innermostUnclosed = contextStack[contextStack.length - 1];
    if (innermostUnclosed.container.kind === 'stack') { // Only stacks can be unclosed this way
        result.errors.push({
            lineNumber: innermostUnclosed.container.lineNumber,
            message: `Unclosed ${innermostUnclosed.container.type.replace('_', ' ')} block started on this line (missing '}'?).`
        });
    }
  }

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
