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
const ZOOM_SENSITIVITY = 0.001;

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
        if (JSON.stringify(nodePositions) !== JSON.stringify(newPositions) || screens.length !== Object.keys(nodePositions).length) {
             setNodePositions(newPositions);
        }
    }
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
  }, [screens, nodePositions, scale]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || !canvasContainerRef.current) return;
    if (e.target !== canvasContainerRef.current && e.target !== canvasContentRef.current && !(e.target instanceof SVGElement && e.target.parentElement === canvasContentRef.current)) {
       return;
    }
    setIsPanning(true);
    setLastPanPosition({ x: e.clientX, y: e.clientY });
    canvasContainerRef.current.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
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
    if (!canvasContainerRef.current) return;

    const rect = canvasContainerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX - translateX) / scale;
    const worldY = (mouseY - translateY) / scale;

    const delta = e.deltaY * ZOOM_SENSITIVITY * -1;
    let newScale = scale * (1 + delta);
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

    const newTranslateX = mouseX - worldX * newScale;
    const newTranslateY = mouseY - worldY * newScale;

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
      style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
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
            ref={el => { screenNodeRefs.current[screen.name] = el; }}
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
              <marker
                id="arrowhead"
                viewBox="-5 -5 10 10"      // Centered viewBox
                refX="1.5"               // Nudge forward from center of line end to tip of arrow
                refY="0"                 // Center vertically
                markerUnits="strokeWidth"// Arrowhead scales with line
                markerWidth="4"          // Viewport size for the marker (adjusts apparent size)
                markerHeight="4"         // Viewport size for the marker
                orient="auto-start-reverse" // Orients arrowhead along the line
              >
                <path d="M -2 -4 L 3 0 L -2 4 Z" fill="#555" /> {/* Adjusted path for new viewBox and desired shape */}
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

                // Approximate visual length of the arrowhead based on strokeWidth and markerWidth
                // markerWidth="4" and strokeWidth={1.5/scale} -> visual size = 4 * (1.5/scale) = 6/scale
                // Add a little extra for spacing.
                const visualArrowheadLength = (4 * (1.5 / scale)) + (3 / scale) ; // Approx 6 + 3 = 9 pixels at scale 1

                let targetX = x2;
                let targetY = y2;

                if (dist > visualArrowheadLength) {
                    const ratio = (dist - visualArrowheadLength) / dist;
                    targetX = x1 + dx * ratio;
                    targetY = y1 + dy * ratio;
                } else {
                    // If nodes are too close, line might be very short or zero length after offset.
                    // Set target to almost same as source to make line tiny or effectively invisible.
                    targetX = x1 + dx * 0.01;
                    targetY = y1 + dy * 0.01;
                }

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
