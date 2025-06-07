import React from 'react';
import { Screen } from '../dsl/parser';
import './ScreenSwitcher.css';

interface ScreenSwitcherProps {
  screens: Screen[];
  activeScreenName: string | null;
  onScreenSelect: (screenName: string) => void;
}

const ScreenSwitcher: React.FC<ScreenSwitcherProps> = ({ screens, activeScreenName, onScreenSelect }) => {
  if (screens.length === 0) {
    return <div className="screen-switcher-placeholder">No screens defined.</div>;
  }

  return (
    <div className="screen-switcher">
      <h4>Screens:</h4>
      <ul>
        {screens.map((screen) => (
          <li key={screen.name}>
            <button
              className={screen.name === activeScreenName ? 'active' : ''}
              onClick={() => onScreenSelect(screen.name)}
            >
              {screen.name} (L{screen.lineNumber})
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ScreenSwitcher;
