import { parseDsl, Screen, BasicComponent, Stack, DslElement, NavigationConfig, ScreenLink, ParseError, ParseResult } from './parser';

describe('DSL Parser (parseDsl)', () => {
  // --- Existing tests for basic components and screens ---
  describe('Basic Syntax (Legacy)', () => {
    it('should parse a single screen with various components', () => {
      const dsl = `
screen TestScreen
  label "Hello World"
  input placeholder="Enter text here"
  button "Click Me"
  image src="test.png"
`;
      const { screens, errors } = parseDsl(dsl);
      expect(errors).toEqual([]);
      expect(screens).toHaveLength(1);
      const screen = screens[0];
      expect(screen.name).toBe('TestScreen');
      expect(screen.components).toHaveLength(4);
      expect(screen.components[0]).toMatchObject({ type: 'label', text: 'Hello World' });
    });

    it('should parse multiple screens', () => {
      const dsl = `
screen Screen1
  label "First screen"
screen Screen2
  button "Go to Screen 1"
`;
      const { screens, errors } = parseDsl(dsl);
      expect(errors).toEqual([]);
      expect(screens).toHaveLength(2);
    });

    it('should handle empty lines and comments gracefully', () => {
      const dsl = `
// This is a comment
screen CommentScreen

  label "With space" # Another comment
`;
      const { screens, errors } = parseDsl(dsl);
      expect(errors).toEqual([]);
      expect(screens[0].components).toHaveLength(1);
    });
  });

  // --- New tests for Stacks (vertical_stack, horizontal_stack) ---
  describe('Stack Parsing', () => {
    it('should parse a vertical_stack with components', () => {
      const dsl = `
screen StackScreen
  vertical_stack {
    label "Inside stack"
    button "Stack Button"
  }
`;
      const { screens, errors } = parseDsl(dsl);
      expect(errors).toEqual([]);
      expect(screens).toHaveLength(1);
      expect(screens[0].components).toHaveLength(1);
      const stack = screens[0].components[0] as Stack;
      expect(stack.type).toBe('vertical_stack');
      expect(stack.components).toHaveLength(2);
      expect(stack.components[0]).toMatchObject({ type: 'label', text: 'Inside stack' });
      expect(stack.components[1]).toMatchObject({ type: 'button', text: 'Stack Button' });
    });

    it('should parse a horizontal_stack with components', () => {
      const dsl = `
screen StackScreen
  horizontal_stack {
    input placeholder="Horiz Input"
    image src="h.png"
  }
`;
      const { screens, errors } = parseDsl(dsl);
      expect(errors).toEqual([]);
      const stack = screens[0].components[0] as Stack;
      expect(stack.type).toBe('horizontal_stack');
      expect(stack.components).toHaveLength(2);
    });

    it('should parse nested stacks', () => {
      const dsl = `
screen NestedStackScreen
  vertical_stack {
    label "Outer"
    horizontal_stack {
      button "Inner Button"
    }
    label "Outer Again"
  }
`;
      const { screens, errors } = parseDsl(dsl);
      expect(errors).toEqual([]);
      expect(screens[0].components).toHaveLength(1);
      const outerStack = screens[0].components[0] as Stack;
      expect(outerStack.type).toBe('vertical_stack');
      expect(outerStack.components).toHaveLength(3);
      expect(outerStack.components[0]).toMatchObject({ type: 'label', text: 'Outer' });
      const innerStack = outerStack.components[1] as Stack;
      expect(innerStack.type).toBe('horizontal_stack');
      expect(innerStack.components).toHaveLength(1);
      expect(innerStack.components[0]).toMatchObject({ type: 'button', text: 'Inner Button' });
      expect(outerStack.components[2]).toMatchObject({ type: 'label', text: 'Outer Again' });
    });

    it('should handle empty stacks', () => {
      const dsl = `
screen EmptyStackScreen
  vertical_stack {}
  horizontal_stack { }
`;
      const { screens, errors } = parseDsl(dsl);
      expect(errors).toEqual([]);
      expect(screens[0].components).toHaveLength(2);
      expect((screens[0].components[0] as Stack).components).toHaveLength(0);
      expect((screens[0].components[1] as Stack).components).toHaveLength(0);
    });

    it('should report error for unclosed stack', () => {
      const dsl = `
screen UnclosedStack
  vertical_stack {
    label "Missing brace"
`;
      const { errors } = parseDsl(dsl);
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: "Unclosed vertical_stack block started on this line (missing '}'?)." })
        ])
      );
    });

    it('should report error for misplaced closing brace for stack', () => {
      const dsl = `
screen MisplacedBrace
  vertical_stack {
    label "Content"
  } } // Extra brace
`;
      const { errors } = parseDsl(dsl);
      // This should be caught as an error. Depending on parser's state after first '}',
      // it might be "Unexpected content at top level" or "Invalid syntax".
      expect(errors.length).toBeGreaterThan(0);
      // Example check, the exact message might vary based on detailed parser recovery.
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: expect.stringMatching(/Extraneous or misplaced closing brace|Unexpected content at top level/) })
        ])
      );
    });
  });

  // --- New tests for Navigation Stacks ---
  describe('Navigation Stack Parsing', () => {
    it('should parse navigation_stack', () => {
      const dsl = 'navigation_stack root=HomeScreen';
      const { navigationStacks, errors } = parseDsl(dsl);
      expect(errors).toEqual([]);
      expect(navigationStacks).toHaveLength(1);
      expect(navigationStacks[0]).toMatchObject({ type: 'navigation_stack', root: 'HomeScreen' });
    });

    it('should parse tab_stack with multiple tabs', () => {
      const dsl = 'tab_stack tabs=[Home, Profile, Settings]';
      const { navigationStacks, errors } = parseDsl(dsl);
      expect(errors).toEqual([]);
      expect(navigationStacks).toHaveLength(1);
      const tabStack = navigationStacks[0] as Extract<NavigationConfig, {type: 'tab_stack'}>;
      expect(tabStack.type).toBe('tab_stack');
      expect(tabStack.tabs).toEqual(['Home', 'Profile', 'Settings']);
    });

    it('should parse drawer_stack', () => {
      const dsl = 'drawer_stack root=Main drawer=SideMenu';
      const { navigationStacks, errors } = parseDsl(dsl);
      expect(errors).toEqual([]);
      expect(navigationStacks).toHaveLength(1);
      expect(navigationStacks[0]).toMatchObject({ type: 'drawer_stack', root: 'Main', drawer: 'SideMenu' });
    });

    it('should report error for multiple navigation definitions', () => {
      const dsl = `
navigation_stack root=A
tab_stack tabs=[B, C]
`;
      const { errors } = parseDsl(dsl);
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: 'Multiple global navigation configurations are not allowed. Define only one (e.g., navigation_stack OR tab_stack OR drawer_stack).' })
        ])
      );
    });

    it('should report error for empty tab_stack tabs array', () => {
      const dsl = 'tab_stack tabs=[]';
      const { errors } = parseDsl(dsl);
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: 'tab_stack must define at least one tab screen name.' })
        ])
      );
    });
  });

  // --- New tests for Screen Linking ---
  describe('Screen Linking Parsing', () => {
    it('should parse a valid screen link', () => {
      const dsl = `
screen ScreenA
screen ScreenB
ScreenA -> ScreenB
`;
      const { links, errors, screens } = parseDsl(dsl);
      expect(errors).toEqual([]); // Post-parsing validation should pass
      expect(links).toHaveLength(1);
      expect(links[0]).toMatchObject({ sourceScreenName: 'ScreenA', destinationScreenName: 'ScreenB' });
    });

    it('should report error for link to non-existent source screen', () => {
      const dsl = `
screen ScreenB
NonExistent -> ScreenB
`;
      const { errors } = parseDsl(dsl);
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: 'Source screen "NonExistent" in link not defined.' })
        ])
      );
    });

    it('should report error for link to non-existent destination screen', () => {
      const dsl = `
screen ScreenA
ScreenA -> NonExistent
`;
      const { errors } = parseDsl(dsl);
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: 'Destination screen "NonExistent" in link not defined.' })
        ])
      );
    });
  });

  // --- Tests for Indentation and Error Recovery (from original set, slightly adapted) ---
  describe('Indentation and Error Recovery', () => {
    it('should return an error for components outside a screen', () => {
      const dsl = 'label "Orphan Label"';
      const { errors } = parseDsl(dsl);
      expect(errors[0]).toMatchObject({ message: 'Unexpected content at top level: "label \"Orphan Label\""' });
    });

    it('should return an error for unindented components within a screen', () => {
      const dsl = `
screen ErrorScreen
label "Not indented"
`;
      const { errors } = parseDsl(dsl);
      // The error message should reflect the expectation within a 'screen' context.
      expect(errors.some(err => err.message.includes("Incorrect indentation. Expected at least 2 spaces for content within 'screen'."))).toBe(true);
    });
  });
});
