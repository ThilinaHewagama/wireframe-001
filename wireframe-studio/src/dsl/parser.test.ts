import { parseDsl, Screen, BasicComponent, Stack, DslElement, NavigationConfig, ScreenLink, ParseError, ParseResult } from './parser';

describe('DSL Parser (parseDsl)', () => {
  // --- Basic Syntax (Legacy) ---
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

  // --- Stack Parsing ---
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
      const outerStack = screens[0].components[0] as Stack;
      expect(outerStack.components).toHaveLength(3);
      const innerStack = outerStack.components[1] as Stack;
      expect(innerStack.type).toBe('horizontal_stack');
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
  });

  // --- Navigation Stack Parsing ---
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
      const tabStack = navigationStacks[0] as Extract<NavigationConfig, {type: 'tab_stack'}>;
      expect(tabStack.type).toBe('tab_stack');
      expect(tabStack.tabs).toEqual(['Home', 'Profile', 'Settings']);
    });

    it('should report error for multiple navigation definitions', () => {
      const dsl = `
navigation_stack root=A
tab_stack tabs=[B, C]
`;
      const { errors } = parseDsl(dsl);
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: 'Only one global navigation construct (navigation_stack, tab_stack, or drawer_stack) is allowed.' })
        ])
      );
    });
  });

  // --- Screen Linking Parsing ---
  describe('Screen Linking Parsing', () => {
    it('should parse a valid screen link', () => {
      const dsl = `
screen ScreenA
screen ScreenB
ScreenA -> ScreenB
`;
      const { links, errors } = parseDsl(dsl);
      expect(errors).toEqual([]);
      expect(links).toHaveLength(1);
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
  });

  // --- Indentation and Error Recovery ---
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
      expect(errors.some(err => err.message === "Incorrect indentation. Expected at least 2 spaces for content within 'screen'. Found 0 spaces.")).toBe(true);
    });
  });

  // --- User-Provided DSL Example and Specific Error Cases ---
  describe('User-Provided DSL Example and Specific Error Cases', () => {
    it('should parse the user-provided DSL example without errors when correctly formatted', () => {
      const dsl = `
navigation_stack root=Welcome

screen Welcome
  vertical_stack {
    label "Welcome to Advanced Wireframe Studio!"
    input placeholder="Enter your name"
    horizontal_stack {
      button "Sign Up"
      button "Login"
    }
  }

screen Dashboard
  vertical_stack {
    label "User Dashboard"
    image src="dashboard-graph.png" // Placeholder image
    button "View Stats"
  }

screen Settings
  label "App Settings"

Welcome -> Dashboard
Dashboard -> Settings
`;
      const { screens, links, navigationStacks, errors } = parseDsl(dsl);

      expect(errors).toEqual([]);
      expect(screens).toHaveLength(3);
      expect(navigationStacks).toHaveLength(1);
      expect(links).toHaveLength(2);

      const welcomeScreen = screens.find(s => s.name === 'Welcome');
      expect(welcomeScreen).toBeDefined();
      expect(welcomeScreen?.components[0].kind).toBe('stack');
      const welcomeVStack = welcomeScreen?.components[0] as Stack;
      expect(welcomeVStack.type).toBe('vertical_stack');
      expect(welcomeVStack.components).toHaveLength(3); // label, input, h_stack
      const welcomeHStack = welcomeVStack.components[2] as Stack; // h_stack is the 3rd element (index 2)
      expect(welcomeHStack.type).toBe('horizontal_stack');
      expect(welcomeHStack.components).toHaveLength(2); // button, button
    });

    it('should correctly report error for an over-indented stack closing brace', () => {
      // screen Welcome (baseIndent 0 for screen content)
      //   vertical_stack { (baseIndent 2 for v_stack content)
      //     ...
      //     horizontal_stack { (baseIndent 4 for h_stack content)
      //       ...
      //     } // This brace closes h_stack. Expected at indent 4.
      //   }   // This brace closes v_stack. Expected at indent 2.

      const dslUserErrorExample = `
screen Welcome
  vertical_stack {
    label "Welcome"
    horizontal_stack {
      button "Login"
    }
    }   # This brace for vertical_stack is at indent 4, but expected at 2
`; // Line 8 (1-indexed)
      const { errors } = parseDsl(dslUserErrorExample);
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            lineNumber: 8,
            message: "Misplaced closing brace '}' for stack 'vertical_stack'. Expected at indent 2, found at 4."
          })
        ])
      );
    });

    it('should correctly parse subsequent top-level items after a screen', () => {
      const dsl = `
screen ScreenOne
  label "Content One"
screen ScreenTwo
  label "Content Two"
ScreenOne -> ScreenTwo
`;
      const { errors, screens, links } = parseDsl(dsl);
      expect(errors).toEqual([]);
      expect(screens).toHaveLength(2);
      expect(screens[0].name).toBe('ScreenOne');
      expect(screens[1].name).toBe('ScreenTwo');
      expect(links).toHaveLength(1);
      expect(links[0]).toMatchObject({sourceScreenName: "ScreenOne", destinationScreenName: "ScreenTwo"});
    });

    it('should handle a closing brace that is correctly indented for its stack but followed by content on same line', () => {
        const dsl = `
screen ErrorLine
    vertical_stack {
        label "test"
    } label "after brace"
`; // Line 4 has content after brace
        const { errors } = parseDsl(dsl);
        expect(errors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    lineNumber: 4,
                    message: "Unexpected content after closing brace '}' on the same line."
                })
            ])
        );
    });

    it('should correctly parse deeply nested stacks with correct brace indentations', () => {
        const dsl = `
screen DeepNest
  v_stack { # baseIndent 2
    label "L1"
    h_stack { # baseIndent 4
      label "L2"
      v_stack { # baseIndent 6
        label "L3"
      } # Closes L3 v_stack, indent 6
    }   # Closes L2 h_stack, indent 4
  }     # Closes L1 v_stack, indent 2
`;
        // Renaming stacks for clarity in test, actual DSL uses full names
        const dslTest = dsl.replace(/v_stack/g, "vertical_stack").replace(/h_stack/g, "horizontal_stack");
        const { errors, screens } = parseDsl(dslTest);
        expect(errors).toEqual([]);
        expect(screens).toHaveLength(1);
        const screen = screens[0];
        expect(screen.components).toHaveLength(1);
        const l1Stack = screen.components[0] as Stack;
        expect(l1Stack.type).toBe('vertical_stack');
        expect(l1Stack.components).toHaveLength(2); // label "L1", h_stack
        const l2Stack = l1Stack.components[1] as Stack;
        expect(l2Stack.type).toBe('horizontal_stack');
        expect(l2Stack.components).toHaveLength(2); // label "L2", v_stack
        const l3Stack = l2Stack.components[1] as Stack;
        expect(l3Stack.type).toBe('vertical_stack');
        expect(l3Stack.components).toHaveLength(1); // label "L3"
    });


  });
});
