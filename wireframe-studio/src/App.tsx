import React, { useState, useEffect } from 'react';
import './App.css';
import Editor from './components/Editor';
import ScreenSwitcher from './components/ScreenSwitcher';
import { parseDsl, ParseResult, Screen as DslScreen, NavigationConfig, ScreenLink, ParseError } from './dsl/parser';
import Renderer from './renderer/Renderer';
import StoryboardCanvas from './components/StoryboardCanvas'; // Actual import

// Define view modes
type ViewMode = 'singleScreen' | 'storyboard';

const initialCode = `navigation_stack root=Welcome

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

function App() {
  const [dslCode, setDslCode] = useState<string>(initialCode);
  const [parseOutput, setParseOutput] = useState<ParseResult>({
    screens: [],
    navigationStacks: [] as NavigationConfig[],
    links: [] as ScreenLink[],
    errors: [] as ParseError[],
  });
  const [activeScreen, setActiveScreen] = useState<DslScreen | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('singleScreen'); // New state for view mode

  useEffect(() => {
    const handler = setTimeout(() => {
      const result = parseDsl(dslCode);
      setParseOutput(result);

      if (result.screens.length > 0) {
        const currentActiveStillExists = result.screens.find(s => s.name === activeScreen?.name);
        if (currentActiveStillExists) {
          setActiveScreen(currentActiveStillExists);
        } else {
          setActiveScreen(result.screens[0]);
        }
      } else {
        setActiveScreen(null);
      }
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [dslCode, activeScreen?.name]);

  const handleEditorChange = (value: string) => {
    setDslCode(value);
  };

  const handleScreenSelect = (screenName: string) => {
    const selected = parseOutput.screens.find(s => s.name === screenName);
    if (selected) {
      setActiveScreen(selected);
      setViewMode('singleScreen'); // Switch to single screen view when a screen is selected from switcher
    }
  };

  const { screens, errors, navigationStacks, links } = parseOutput;

  return (
    <div className="App">
      <div className="pane editor-pane">
        <Editor value={dslCode} onChange={handleEditorChange} errors={errors} />
        {errors.length > 0 && (
          <div className="error-display">
            <h3>Errors:</h3>
            {errors.map((err, index) => (
              <p key={index}>Line {err.lineNumber}: {err.message}</p>
            ))}
          </div>
        )}
        {/* Debug output removed */}
      </div>

      <div className="pane renderer-pane">
        <div className="view-mode-switcher">
          <button onClick={() => setViewMode('singleScreen')} className={viewMode === 'singleScreen' ? 'active' : ''}>
            Single Screen
          </button>
          <button onClick={() => setViewMode('storyboard')} className={viewMode === 'storyboard' ? 'active' : ''}>
            Storyboard
          </button>
        </div>

        {viewMode === 'singleScreen' ? (
          <>
            <ScreenSwitcher
              screens={screens}
              activeScreenName={activeScreen?.name || null}
              onScreenSelect={handleScreenSelect}
            />
            <Renderer screen={activeScreen} />
          </>
        ) : (
          <StoryboardCanvas screens={screens} links={links} navigationStacks={navigationStacks} />
        )}
      </div>
    </div>
  );
}

export default App;
