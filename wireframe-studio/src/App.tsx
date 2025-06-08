import React, { useState, useEffect } from 'react';
import './App.css';
import Editor from './components/Editor';
import ScreenSwitcher from './components/ScreenSwitcher'; // Import ScreenSwitcher
import { parseDsl, ParseResult, Screen as DslScreen, NavigationConfig, ScreenLink } from './dsl/parser';
import Renderer from './renderer/Renderer';

function App() {
  const initialCode = `screen HomeScreen
  label "Welcome to Wireframe Studio!"
  input placeholder="Enter your name"
  button "Get Started"
  image src="https://via.placeholder.com/300x100.png?text=Sample+Image"

screen ProfileScreen
  image src="profile.jpg"
  label "User Profile"
  input placeholder="Username"
  button "Save Changes"

screen SettingsScreen
  label "App Settings"
  input placeholder="API Key"
  button "Update Settings"`;

  const [dslCode, setDslCode] = useState<string>(initialCode);
  const [parseOutput, setParseOutput] = useState<ParseResult>({ screens: [], navigationStacks: [], links: [], errors: [] });
  const [activeScreen, setActiveScreen] = useState<DslScreen | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      const result = parseDsl(dslCode);
      setParseOutput(result);

      if (result.screens.length > 0) {
        // If current active screen is still valid, keep it. Otherwise, default to first.
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
  }, [dslCode, activeScreen?.name]); // Add activeScreen?.name to dependencies to re-evaluate if it changes externally

  const handleEditorChange = (value: string) => {
    setDslCode(value);
  };

  const handleScreenSelect = (screenName: string) => {
    const selected = parseOutput.screens.find(s => s.name === screenName);
    if (selected) {
      setActiveScreen(selected);
    }
  };

  const errors = parseOutput.errors; // This line already exists and is correct

  return (
    <div className="App">
      <div className="pane editor-pane">
        {/* Pass the errors prop to the Editor component */}
        <Editor value={dslCode} onChange={handleEditorChange} errors={errors} />
        {errors.length > 0 && (
          <div className="error-display">
            <h3>Errors:</h3>
            {errors.map((err, index) => (
              <p key={index}>Line {err.lineNumber}: {err.message}</p>
            ))}
          </div>
        )}
      </div>
      <div className="pane renderer-pane">
        <ScreenSwitcher
          screens={parseOutput.screens}
          activeScreenName={activeScreen?.name || null}
          onScreenSelect={handleScreenSelect}
        />
        <Renderer screen={activeScreen} />
      </div>
    </div>
  );
}

export default App;
