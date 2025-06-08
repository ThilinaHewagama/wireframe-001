import React from 'react';
import { Screen, BasicComponent, Stack, DslElement } from '../dsl/parser'; // Ensure all are imported
import './Renderer.css';

// Helper function to sanitize URLs
const sanitizeUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('javascript:') || url.startsWith('data:')) {
    console.warn(`Blocked potentially unsafe URL: ${url}`);
    return undefined;
  }
  return url;
};

// Recursive function to render DSL elements
const renderDslElement = (element: DslElement, index: number): React.ReactElement | null => {
  if ('components' in element) { // It's a Stack
    const stack = element as Stack;
    return (
      <div key={index} className={`wireframe-stack ${stack.type.replace('_', '-')}`}>
        {stack.components.map((childElement, childIndex) =>
          renderDslElement(childElement, childIndex)
        )}
      </div>
    );
  }

  // It's a BasicComponent
  const component = element as BasicComponent;
  switch (component.type) {
    case 'label':
      return <p key={index} className="wireframe-label">{component.text}</p>;
    case 'input':
      return (
        <input
          key={index}
          type="text"
          placeholder={component.placeholder}
          className="wireframe-input"
          readOnly
        />
      );
    case 'button':
      return <button key={index} className="wireframe-button">{component.text}</button>;
    case 'image':
      const safeSrc = sanitizeUrl(component.src);
      return (
        <div key={index} className="wireframe-image" data-src={component.src || 'not specified'}>
          {safeSrc ? <img src={safeSrc} alt={`Wireframe: ${component.src}`} /> : null}
        </div>
      );
    default:
      // This case should ideally not be reached if parser is correct
      // For type safety with discriminated unions, this would be:
      // const _exhaustiveCheck: never = component;
      // return null;
      // However, to provide some feedback if new types are added and not handled:
      return <p key={index} style={{ color: 'red' }}>Unknown component type: {(component as any)?.type}</p>;
  }
};

interface RendererProps {
  screen: Screen | null;
}

const Renderer: React.FC<RendererProps> = ({ screen }) => {
  if (!screen) {
    return (
      <div className="mobile-viewport-container">
        <div className="mobile-frame renderer-placeholder">
          No screen selected or DSL is empty.
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-viewport-container">
      <div className="mobile-frame">
        <div className="wireframe-screen" data-screen-name={screen.name}>
          {/* The components-stack div might be redundant if .wireframe-screen itself is a flex container for its direct children.
              For now, keeping it for clarity as the direct container of root-level DslElements for a screen.
              If .wireframe-screen becomes the flex container, direct children (stacks or components) will align according to its flex properties.
              The top-level of a screen usually behaves like a vertical stack.
           */}
          <div className="components-stack">
            {screen.components.map((element, idx) => renderDslElement(element, idx))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Renderer;
