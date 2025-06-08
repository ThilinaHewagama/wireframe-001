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
      // ... other assertions
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
      expect(navigationStacks[0]).toMatchObject({ type: 'navigation_stack', root: 'HomeScreen' });
    });
    // ... other navigation tests
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
    // ... other link tests
  });

  // --- Indentation and Error Recovery ---
  describe('Indentation and Error Recovery', () => {
    // ... indentation tests
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
    image src="dashboard-graph.png"
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
      // Corrected access to 'kind'
      const firstWelcomeComponent = welcomeScreen?.components[0];
      expect(firstWelcomeComponent).toBeDefined();
      // Use a type guard or ensure it's a stack before asserting .kind
      if (firstWelcomeComponent && 'kind' in firstWelcomeComponent && firstWelcomeComponent.kind === 'stack') {
        // Now TypeScript knows firstWelcomeComponent is a Stack here
        expect(firstWelcomeComponent.kind).toBe('stack'); // This assertion is now safer
        const welcomeVStack = firstWelcomeComponent as Stack; // Type assertion is safer after the guard
        expect(welcomeVStack.type).toBe('vertical_stack');
        expect(welcomeVStack.components).toHaveLength(3);
        const welcomeHStack = welcomeVStack.components[2] as Stack;
        expect(welcomeHStack.type).toBe('horizontal_stack');
        expect(welcomeHStack.components).toHaveLength(2);
      } else {
        fail('First component of Welcome screen was not a Stack or was undefined');
      }
    });

    it('should correctly report error for an over-indented stack closing brace', () => {
      const dslUserErrorExample = `
screen Welcome
  vertical_stack {
    label "Welcome"
    horizontal_stack {
      button "Login"
    } # Correctly indented brace for horizontal_stack (at indent 4)
    }   # This brace for vertical_stack is at indent 4, but expected at 2
`;
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
      expect(links).toHaveLength(1);
    });
  });
});
