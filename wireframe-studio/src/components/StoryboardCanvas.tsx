import React, { useEffect, useRef, useState, useLayoutEffect, useCallback } from 'react';
import { Screen, ScreenLink, NavigationConfig } from '../dsl/parser';
import './StoryboardCanvas.css';

interface StoryboardCanvasProps {
  screens: Screen[];
  links: ScreenLink[];
  navigationStacks: NavigationConfig[];
}

interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 3.0;
const ZOOM_SENSITIVITY = 0.001; // Adjust for more or less sensitive zooming

const StoryboardCanvas: React.FC<StoryboardCanvasProps> = ({ screens, links, navigationStacks }) => {
  const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({});
  const screenNodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasContentRef = useRef<HTMLDivElement | null>(null);

  const [isPanning, setIsPanning] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [lastPanPosition, setLastPanPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  useEffect(() => {
    screenNodeRefs.current = screens.reduce((acc, screen) => {
      acc[screen.name] = screenNodeRefs.current[screen.name] || null;
      return acc;
    }, {} as Record<string, HTMLDivElement | null>);
  }, [screens]);

  useLayoutEffect(() => {
    const newPositions: Record<string, NodePosition> = {};
    let allNodesRendered = true;
    if (!canvasContentRef.current) {
        allNodesRendered = false;
    } else {
        for (const screen of screens) {
        const node = screenNodeRefs.current[screen.name];
        if (node) {
            newPositions[screen.name] = {
            x: node.offsetLeft,
            y: node.offsetTop,
            width: node.offsetWidth,
            height: node.offsetHeight,
            centerX: node.offsetLeft + node.offsetWidth / 2,
            centerY: node.offsetTop + node.offsetHeight / 2,
            };
        } else {
            allNodesRendered = false;
            break;
        }
        }
    }
    if (allNodesRendered && (Object.keys(newPositions).length === screens.length || screens.length === 0) ) {
        // Update if number of screens changed or if positions differ
        if (JSON.stringify(nodePositions) !== JSON.stringify(newPositions) || screens.length !== Object.keys(nodePositions).length) {
             setNodePositions(newPositions);
        }
    }
  // Re-run when screens array changes, or scale/translate changes as it might affect layout indirectly
  // or if nodePositions was empty and is now populated.
  }, [screens, scale, translateX, translateY, nodePositions]);

  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const updateSize = () => {
        if (canvasContentRef.current) {
        setSvgDimensions({
            width: canvasContentRef.current.scrollWidth,
            height: canvasContentRef.current.scrollHeight,
        });
        }
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [screens, nodePositions, scale]); // Update SVG size when content or scale changes

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || !canvasContainerRef.current) return;
    // Allow panning only if the direct target is the canvas container or the content div itself,
    // not the screen nodes or other elements.
    if (e.target !== canvasContainerRef.current && e.target !== canvasContentRef.current) {
        // Check if target is an SVG element (like a line) inside canvasContentRef, allow pan
        if (!(e.target instanceof SVGElement && e.target.parentElement === canvasContentRef.current)) {
           return;
        }
    }

    setIsPanning(true);
    setLastPanPosition({ x: e.clientX, y: e.clientY });
    canvasContainerRef.current.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !canvasContainerRef.current) return;
    const deltaX = e.clientX - lastPanPosition.x;
    const deltaY = e.clientY - lastPanPosition.y;
    setTranslateX(prev => prev + deltaX);
    setTranslateY(prev => prev + deltaY);
    setLastPanPosition({ x: e.clientX, y: e.clientY });
  }, [isPanning, lastPanPosition]);

  const handleMouseUpOrLeave = useCallback(() => {
    if (isPanning) {
        setIsPanning(false);
        if (canvasContainerRef.current) canvasContainerRef.current.style.cursor = 'grab';
        document.body.style.userSelect = '';
    }
  }, [isPanning]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (!canvasContainerRef.current || !canvasContentRef.current) return;

    const rect = canvasContainerRef.current.getBoundingClientRect();
    const mouseXInContainer = e.clientX - rect.left;
    const mouseYInContainer = e.clientY - rect.top;

    const worldXBeforeZoom = (mouseXInContainer - translateX) / scale;
    const worldYBeforeZoom = (mouseYInContainer - translateY) / scale;

    const delta = e.deltaY * ZOOM_SENSITIVITY * -1;
    let newScale = scale * (1 + delta); // Multiplicative scaling for smoother feel
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

    const newTranslateX = mouseXInContainer - worldXBeforeZoom * newScale;
    const newTranslateY = mouseYInContainer - worldYBeforeZoom * newScale;

    setScale(newScale);
    setTranslateX(newTranslateX);
    setTranslateY(newTranslateY);

  }, [scale, translateX, translateY]);


  return (
    <div
      className="storyboard-canvas-container"
      ref={canvasContainerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
      onWheel={handleWheel}
      style={{ cursor: 'grab' }}
    >
      <div
        className="storyboard-canvas"
        ref={canvasContentRef}
        style={{
          transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
        }}
      >
        {screens.map((screen) => (
          <div
            key={screen.name}
            ref={el => screenNodeRefs.current[screen.name] = el}
            className="storyboard-screen-node"
            id={`screen-node-${screen.name}`}
          >
            <div className="screen-node-title">{screen.name}</div>
            <div className="screen-node-content-placeholder">
              ({screen.components.length} elements)
            </div>
          </div>
        ))}

        {Object.keys(nodePositions).length > 0 && (
          <svg
            className="storyboard-links-svg"
            width={svgDimensions.width}
            height={svgDimensions.height}
          >
            <defs>
              <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse" fill="#555">
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
            </defs>
            {links.map((link, index) => {
              const sourcePos = nodePositions[link.sourceScreenName];
              const destPos = nodePositions[link.destinationScreenName];

              if (sourcePos && destPos) {
                let x1 = sourcePos.centerX;
                let y1 = sourcePos.centerY;
                let x2 = destPos.centerX;
                let y2 = destPos.centerY;

                const dx = x2 - x1;
                const dy = y2 - y1;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist === 0) return null;

                // Adjust end point for arrowhead (approximate)
                // Arrowhead size in marker def is 6x8, refX=8.
                // Effective arrow length for offset calculation can be around 10-15px at scale=1
                const arrowVisualLength = 10;
                const ratio = (dist - arrowVisualLength) / dist;

                const targetX = (ratio > 0) ? (x1 + dx * ratio) : x1; // If nodes are too close, line ends at source center
                const targetY = (ratio > 0) ? (y1 + dy * ratio) : y1;


                return (
                  <line
                    key={index}
                    x1={x1}
                    y1={y1}
                    x2={targetX}
                    y2={targetY}
                    stroke="#555"
                    strokeWidth={1.5 / scale}
                    markerEnd="url(#arrowhead)"
                  />
                );
              }
              return null;
            })}
          </svg>
        )}

        {screens.length === 0 && (
          <div className="storyboard-empty-placeholder">
            <p>No screens defined in the DSL.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryboardCanvas;
