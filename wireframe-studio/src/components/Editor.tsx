import React, { useEffect, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/language';
import { simpleMode } from '../dsl/simpleMode'; // Assuming simpleMode is in dsl/simpleMode.ts
import { linter, Diagnostic } from '@codemirror/lint';
import { EditorView } from '@codemirror/view'; // For theme customization if needed
import { ParseError } from '../dsl/parser'; // Import ParseError type

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  errors: ParseError[]; // Accept errors as a prop
}

const dslLinter = (view: EditorView, errors: ParseError[]): Diagnostic[] => {
  // Note: The 'view' parameter is implicitly provided by CodeMirror when it calls this linter function.
  // We only need to ensure our outer function (the one passed to linter()) matches the expected signature.
  // The actual diagnostics are generated based on the 'errors' prop.

  // Need to handle the case where view.state.doc.line might fail if err.lineNumber is out of bounds.
  // This can happen if DSL text changes faster than errors are updated, or if line numbers are off.
  const diagnostics: Diagnostic[] = [];
  for (const err of errors) {
    if (err.lineNumber <= 0 || err.lineNumber > view.state.doc.lines) {
      // Invalid line number, skip or log this error.
      // Alternatively, could place a general error at the top of the document.
      console.warn(`Invalid line number for error: ${err.lineNumber}`);
      diagnostics.push({
        from: 0,
        to: 0,
        severity: 'error',
        message: `L${err.lineNumber}: ${err.message} (Error at invalid line)`,
      });
      continue;
    }
    const line = view.state.doc.line(err.lineNumber);
    diagnostics.push({
      from: line.from, // Start of the line
      to: line.to,     // End of the line
      severity: 'error',
      message: err.message,
      // source: "DSL Parser", // Optional: if you want to specify the source
    });
  }
  return diagnostics;
};

const Editor: React.FC<EditorProps> = ({ value, onChange, errors }) => {
  // The linter extension expects a function that takes an EditorView and returns Diagnostic[]
  // We use useMemo to recreate this function only when 'errors' changes.
  const activeDslLinter = useMemo(() => {
    return linter(view => dslLinter(view, errors));
  }, [errors]);

  // Custom theme to ensure highlighted error lines are visible
  const errorTheme = EditorView.theme({
    '.cm-lintRange-error': {
      backgroundColor: 'rgba(255, 0, 0, 0.15)', // More subtle background
      borderLeft: '3px solid red',
      paddingLeft: '2px',
      // Draw a red underline too
     },
     '.cm-diagnostic-error': { // This targets the gutter marker and the text itself
        // borderLeft: '3px solid red' // Gutter marker styling is usually handled by .cm-lintMarker-error
     }
  });


  return (
    <CodeMirror
      value={value}
      height="100%" // Ensure it fills its container
      extensions={[
        StreamLanguage.define(simpleMode),
        activeDslLinter, // Add the linter extension
        errorTheme,     // Add the custom theme for error styling
      ]}
      onChange={onChange}
      theme="light" // Using a light theme, ensure error styles are visible
    />
  );
};

export default Editor;
