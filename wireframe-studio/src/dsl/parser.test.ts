import { parseDsl, Screen, Component, ParseError } from './parser';

describe('DSL Parser (parseDsl)', () => {
  // Test suite for valid DSL syntax
  describe('Valid DSL Syntax', () => {
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
      expect(screen.components[1]).toMatchObject({ type: 'input', placeholder: 'Enter text here' });
      expect(screen.components[2]).toMatchObject({ type: 'button', text: 'Click Me' });
      expect(screen.components[3]).toMatchObject({ type: 'image', src: 'test.png' });
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
      expect(screens[0].name).toBe('Screen1');
      expect(screens[0].components[0]).toMatchObject({ type: 'label', text: 'First screen' });
      expect(screens[1].name).toBe('Screen2');
      expect(screens[1].components[0]).toMatchObject({ type: 'button', text: 'Go to Screen 1' });
    });

    it('should handle empty lines and comments gracefully', () => {
      const dsl = `
// This is a comment
screen CommentScreen

  label "With space" // Another comment

  // Empty line above
  button "Test"
# Hash comment
`;
      const { screens, errors } = parseDsl(dsl);
      expect(errors).toEqual([]);
      expect(screens).toHaveLength(1);
      expect(screens[0].name).toBe('CommentScreen');
      expect(screens[0].components).toHaveLength(2);
      expect(screens[0].components[0]).toMatchObject({ type: 'label', text: 'With space' });
      expect(screens[0].components[1]).toMatchObject({ type: 'button', text: 'Test' });
    });

    it('should parse input without placeholder', () => {
      const dsl = `
screen InputScreen
  input
`;
      const { screens, errors } = parseDsl(dsl);
      expect(errors).toEqual([]);
      expect(screens).toHaveLength(1);
      expect(screens[0].components[0]).toMatchObject({ type: 'input', placeholder: '' });
    });

    it('should allow hyphens and numbers in screen names', () => {
      const dsl = 'screen My-Screen-123\n  label "Test"';
      const { screens, errors } = parseDsl(dsl);
      expect(errors).toEqual([]);
      expect(screens).toHaveLength(1);
      expect(screens[0].name).toBe('My-Screen-123');
    });
  });

  // Test suite for invalid DSL syntax and error handling
  describe('Invalid DSL Syntax and Error Handling', () => {
    it('should return an error for components outside a screen', () => {
      const dsl = 'label "Orphan Label"';
      const { screens, errors } = parseDsl(dsl);
      expect(screens).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        lineNumber: 1,
        message: 'Component definition outside of a screen block.',
      });
    });

    it('should return an error for invalid component syntax', () => {
      const dsl = `
screen ErrorScreen
  invalidComponent "This is wrong"
`;
      const { screens, errors } = parseDsl(dsl);
      expect(screens[0].components).toHaveLength(0); // No component should be parsed
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        lineNumber: 3, // Line number of the invalid component
        message: 'Invalid syntax: "invalidComponent \"This is wrong\""',
      });
    });

    it('should return an error for unindented components', () => {
      const dsl = `
screen ErrorScreen
label "Not indented"
`;
      const { screens, errors } = parseDsl(dsl);
      expect(screens[0].components).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        lineNumber: 3,
        message: 'Component definition must be indented (e.g., with two spaces).',
      });
    });

    it('should return an error for duplicate screen names', () => {
      const dsl = `
screen MyScreen
  label "First"
screen MyScreen
  label "Second"
`;
      const { screens, errors } = parseDsl(dsl);
      expect(screens).toHaveLength(2); // Both screens are parsed, but error is logged
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        lineNumber: 4, // Line where the duplicate screen is defined
        message: 'Duplicate screen name: MyScreen',
      });
    });

    it('should return an error for invalid image src (javascript URI)', () => {
      const dsl = 'screen ImgScreen\n  image src="javascript:alert(1)"';
      const { screens, errors } = parseDsl(dsl);
      expect(screens[0].components).toHaveLength(1); // Component is parsed
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        lineNumber: 2,
        message: 'Invalid image src: "javascript:alert(1)". Must be a valid URL, an absolute path, or a local file name.',
      });
    });

    it('should handle multiple errors', () => {
      const dsl = `
label "Orphan"
screen Test
  badline
  input placeholder="Good"
screen Test
  image src="data:image/png;base64,..."
`;
      const { screens, errors } = parseDsl(dsl);
      expect(errors).toHaveLength(4); // Orphan, badline, duplicate screen, data URI for image
      expect(errors.map(e => e.message)).toEqual(
        expect.arrayContaining([
          "Component definition outside of a screen block.",
          'Invalid syntax: "badline"',
          "Duplicate screen name: Test",
          'Invalid image src: "data:image/png;base64,...". Must be a valid URL, an absolute path, or a local file name.'
        ])
      );
    });
  });
});
