export interface BasicComponent {
  type: 'label' | 'input' | 'button' | 'image';
  text?: string;
  placeholder?: string;
  src?: string;
  lineNumber: number;
}

export interface Stack {
  kind: 'stack';
  type: 'vertical_stack' | 'horizontal_stack';
  components: DslElement[];
  lineNumber: number;
}

export type DslElement = BasicComponent | Stack;

export interface Screen {
  kind: 'screen';
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

const countIndentation = (line: string): number => line.match(/^\s*/)?.[0].length || 0;

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
    let lineConsumedByBrace = false;

    if (emptyLineRegex.test(line) || commentRegex.test(line)) {
      continue;
    }

    const currentIndent = countIndentation(line);
    const lineContent = line.trimStart();

    // Pop stack contexts based on indentation or closing braces
    // This loop handles correctly indented closing braces and de-indentation for stacks.
    while (contextStack.length > 0) {
      const currentLoopContext = contextStack[contextStack.length - 1];
      if (currentLoopContext.container.kind === 'stack' && stackEndRegex.test(lineContent) && currentIndent === currentLoopContext.baseIndent) {
        contextStack.pop();
        if (lineContent.replace(stackEndRegex, '').trim() === '') {
            lineConsumedByBrace = true; // Mark line as consumed if it was *only* a valid closing brace
        }
        // Continue popping if this brace also closes parent stacks at the same indent
      } else if (currentLoopContext.container.kind === 'stack' && currentIndent <= currentLoopContext.baseIndent) {
        contextStack.pop();
      } else {
        break;
      }
    }

    if (lineConsumedByBrace) {
        continue;
    }

    if (contextStack.length > 0 && contextStack[contextStack.length - 1].container.kind === 'screen') {
        if (currentIndent === 0 && !stackEndRegex.test(lineContent)) {
            contextStack.pop();
        }
    }

    let activeContext = contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;
    const expectedComponentIndent = activeContext ? activeContext.baseIndent + 2 : 0;
    let match: RegExpExecArray | null;

    if (!activeContext && currentIndent === 0) {
      if ((match = navigationStackRegex.exec(lineContent))) {
        if (result.navigationStacks.length > 0) {
             result.errors.push({ lineNumber, message: 'Only one global navigation construct (navigation_stack, tab_stack, or drawer_stack) is allowed.' });
        } else {
             result.navigationStacks.push({ type: 'navigation_stack', root: match[1], lineNumber });
        }
        continue;
      }
      if ((match = tabStackRegex.exec(lineContent))) {
         if (result.navigationStacks.length > 0) { result.errors.push({ lineNumber, message: 'Only one global navigation construct is allowed.' }); }
         else {
            const tabs = match[1].split(',').map(t => t.trim()).filter(t => t.length > 0);
            if (tabs.length === 0) { result.errors.push({ lineNumber, message: 'tab_stack must define at least one tab screen name.' }); }
            else { result.navigationStacks.push({ type: 'tab_stack', tabs, lineNumber }); }
         }
        continue;
      }
      if ((match = drawerStackRegex.exec(lineContent))) {
         if (result.navigationStacks.length > 0) { result.errors.push({ lineNumber, message: 'Only one global navigation construct is allowed.' }); }
         else { result.navigationStacks.push({ type: 'drawer_stack', root: match[1], drawer: match[2], lineNumber }); }
        continue;
      }
      if ((match = screenLinkRegex.exec(lineContent))) {
        result.links.push({ sourceScreenName: match[1], destinationScreenName: match[2], lineNumber});
        continue;
      }
      if ((match = screenRegex.exec(lineContent))) {
        if (result.screens.find(s => s.name === match![1])) { result.errors.push({ lineNumber, message: `Duplicate screen name: ${match[1]}` });}
        const newScreen: Screen = { kind: 'screen', name: match[1], components: [], lineNumber };
        result.screens.push(newScreen);
        contextStack.push({ container: newScreen, baseIndent: currentIndent });
        activeContext = contextStack[contextStack.length -1];
        continue;
      }
    }

    if (!activeContext) {
        if (! (screenRegex.test(lineContent) || navigationStackRegex.test(lineContent) || tabStackRegex.test(lineContent) || drawerStackRegex.test(lineContent) || screenLinkRegex.test(lineContent)) ) {
            result.errors.push({ lineNumber, message: `Unexpected content at top level: "${lineContent}"` });
        }
        continue;
    }

    // *** REFINED LOGIC FOR STACK CLOSING BRACE (handles mis-indented but contextually closing braces) ***
    if (activeContext.container.kind === 'stack' && stackEndRegex.test(lineContent)) {
        // Log error if brace is misplaced (not at the stack's baseIndent)
        if (currentIndent !== activeContext.baseIndent) {
            result.errors.push({ lineNumber, message: `Misplaced closing brace '}' for stack '${activeContext.container.type}'. Expected at indent ${activeContext.baseIndent}, found at ${currentIndent}.` });
        }
        // Pop the current stack context, as this '}' is closing it.
        // This handles cases where the initial `while` loop might not have popped it (e.g., over-indented brace).
        if (contextStack.length > 0 && contextStack[contextStack.length - 1].container === activeContext.container) {
             contextStack.pop();
        }
        // If the line was ONLY the brace (misplaced or not), consume it.
        if (lineContent.replace(stackEndRegex, '').trim() === '') {
            continue;
        }
        // If there's content after the brace on the same line, it's an error.
        result.errors.push({ lineNumber, message: `Unexpected content after closing brace '}' on the same line.`});
        continue;
    }
    // If it's a brace, but the active context is not a stack (e.g., a screen), it's an error.
    if (stackEndRegex.test(lineContent) && activeContext.container.kind === 'screen') {
        result.errors.push({ lineNumber, message: `Extraneous closing brace '}' not valid within a screen context.`});
        continue;
    }
    // If it's a brace but not caught by above (e.g. no active context, but already handled), it's an error.
    if (stackEndRegex.test(lineContent)) { // Should be caught by !activeContext logic if at top level
        result.errors.push({ lineNumber, message: `Extraneous or misplaced closing brace '}'.`});
        continue;
    }

    if (currentIndent < expectedComponentIndent) {
        const contextTypeDisplay = activeContext.container.kind === 'stack' ? activeContext.container.type : activeContext.container.kind;
        result.errors.push({ lineNumber, message: `Incorrect indentation. Expected at least ${expectedComponentIndent} spaces for content within '${contextTypeDisplay}'. Found ${currentIndent} spaces.` });
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

    const contextTypeDisplay = activeContext.container.kind === 'stack' ? activeContext.container.type : activeContext.container.kind;
    result.errors.push({ lineNumber, message: `Invalid syntax or misplaced content within '${contextTypeDisplay}': "${lineContent}"` });
  }

  if (contextStack.length > 0) {
    const innermostUnclosed = contextStack[contextStack.length - 1];
    if (innermostUnclosed.container.kind === 'stack') {
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
