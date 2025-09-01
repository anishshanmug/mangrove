import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { TaskNode } from '../types';
import { TaskStatus } from '../types';

interface Position {
  x: number;
  y: number;
}



interface TreeCanvasProps {
  tree: TaskNode;
  onUpdateNode: (nodeId: string, updates: { title?: string; status?: TaskStatus; description?: string }) => void;
  onAddChild: (parentId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onNodeSelect: (nodeId: string | null) => void;
  selectedNodeId: string | null;
}

const NODE_WIDTH = 160;
const NODE_MIN_HEIGHT = 80;
const NODE_PADDING = 16;
const LINE_HEIGHT = 18;
const CHARS_PER_LINE = 18;
const LEVEL_HEIGHT = 150;
const SIBLING_SPACING = 200;

export const TreeCanvas: React.FC<TreeCanvasProps> = ({
  tree,
  onUpdateNode,
  onAddChild,
  onDeleteNode,
  onNodeSelect,
  selectedNodeId,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodePositions, setNodePositions] = useState<Map<string, Position>>(new Map());
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 1200, height: 800 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Position>({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  // Calculate initial node positions using a tree layout algorithm
  const calculateNodePositions = useCallback((node: TaskNode): Map<string, Position> => {
    const positions = new Map<string, Position>();
    
    // First pass: calculate tree dimensions and assign x positions

    const layoutNode = (node: TaskNode, level: number, xOffset: number): number => {
      const y = level * LEVEL_HEIGHT + 100;
      
      if (node.children.length === 0) {
        // Leaf node
        const x = xOffset + SIBLING_SPACING / 2;
        positions.set(node.id, { x, y });
        return SIBLING_SPACING;
      } else {
        // Internal node
        let childXOffset = xOffset;
        let totalWidth = 0;
        
        // Layout children first
        for (const child of node.children) {
          const childWidth = layoutNode(child, level + 1, childXOffset);
          childXOffset += childWidth;
          totalWidth += childWidth;
        }
        
        // Position this node at the center of its children
        const x = xOffset + totalWidth / 2;
        positions.set(node.id, { x, y });
        
        return totalWidth;
      }
    };

    layoutNode(node, 0, 0);
    return positions;
  }, []);

  // Initialize positions when tree changes
  useEffect(() => {
    if (tree) {
      const positions = calculateNodePositions(tree);
      setNodePositions(positions);
    }
  }, [tree, calculateNodePositions]);

  // Get all nodes in a flat list for easier processing
  const getAllNodes = (node: TaskNode): TaskNode[] => {
    const nodes = [node];
    node.children.forEach(child => {
      nodes.push(...getAllNodes(child));
    });
    return nodes;
  };

  // Get connections between nodes
  const getConnections = (node: TaskNode): Array<{from: string, to: string}> => {
    const connections: Array<{from: string, to: string}> = [];
    node.children.forEach(child => {
      connections.push({ from: node.id, to: child.id });
      connections.push(...getConnections(child));
    });
    return connections;
  };

  // Handle mouse events for dragging
  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0) return; // Only left mouse button
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const svgX = (e.clientX - rect.left) * (viewBox.width / rect.width) + viewBox.x;
    const svgY = (e.clientY - rect.top) * (viewBox.height / rect.height) + viewBox.y;
    
    const nodePos = nodePositions.get(nodeId);
    if (nodePos) {
      setDraggedNode(nodeId);
      setDragOffset({
        x: svgX - nodePos.x,
        y: svgY - nodePos.y,
      });
    }
  };

  // Handle node click to select
  const handleNodeClick = (nodeId: string) => {
    if (selectedNodeId === nodeId) {
      onNodeSelect(null);
    } else {
      onNodeSelect(nodeId);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const svgX = (e.clientX - rect.left) * (viewBox.width / rect.width) + viewBox.x;
    const svgY = (e.clientY - rect.top) * (viewBox.height / rect.height) + viewBox.y;
    
    if (draggedNode) {
      // Update node position
      const newPosition = {
        x: svgX - dragOffset.x,
        y: svgY - dragOffset.y,
      };
      
      setNodePositions(prev => new Map(prev.set(draggedNode, newPosition)));
    } else if (isPanning) {
      // Pan the view
      const deltaX = (e.clientX - panStart.x) * (viewBox.width / rect.width);
      const deltaY = (e.clientY - panStart.y) * (viewBox.height / rect.height);
      
      setViewBox(prev => ({
        ...prev,
        x: prev.x - deltaX,
        y: prev.y - deltaY,
      }));
      
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
    setIsPanning(false);
  };

  // Handle canvas panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || draggedNode) return;
    
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
  };

  // Handle wheel events for zooming
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    const mouseX = (e.clientX - rect.left) * (viewBox.width / rect.width) + viewBox.x;
    const mouseY = (e.clientY - rect.top) * (viewBox.height / rect.height) + viewBox.y;
    
    const newWidth = viewBox.width * zoomFactor;
    const newHeight = viewBox.height * zoomFactor;
    
    setViewBox({
      x: mouseX - (mouseX - viewBox.x) * zoomFactor,
      y: mouseY - (mouseY - viewBox.y) * zoomFactor,
      width: newWidth,
      height: newHeight,
    });
  };

  // Handle node editing
  const handleNodeDoubleClick = (nodeId: string, currentTitle: string) => {
    setEditingNode(nodeId);
    setEditValue(currentTitle);
  };

  const handleEditSubmit = (nodeId: string) => {
    if (editValue.trim() !== '') {
      onUpdateNode(nodeId, { title: editValue.trim() });
    }
    setEditingNode(null);
    setEditValue('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, nodeId: string) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      // Ctrl+Enter to save
      handleEditSubmit(nodeId);
    } else if (e.key === 'Escape') {
      setEditingNode(null);
      setEditValue('');
    }
  };

  // Handle status cycling
  const handleStatusCycle = (nodeId: string, currentStatus: TaskStatus) => {
    const statusOrder = [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.CANCELLED];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const nextIndex = (currentIndex + 1) % statusOrder.length;
    const nextStatus = statusOrder[nextIndex];
    onUpdateNode(nodeId, { status: nextStatus });
  };

  const getStatusColor = (status: TaskStatus): string => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return 'var(--success)';
      case TaskStatus.IN_PROGRESS:
        return 'var(--warning)';
      case TaskStatus.CANCELLED:
        return 'var(--error)';
      default:
        return 'var(--accent-primary)';
    }
  };

  // Helper function to break text into lines
  const wrapText = (text: string, maxCharsPerLine: number): string[] => {
    if (text.length <= maxCharsPerLine) return [text];
    
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      
      if (testLine.length <= maxCharsPerLine) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Word is longer than max chars, break it
          for (let i = 0; i < word.length; i += maxCharsPerLine) {
            lines.push(word.substring(i, i + maxCharsPerLine));
          }
          currentLine = '';
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  };

  // Calculate node height based on text length
  const getNodeHeight = (text: string): number => {
    const lines = wrapText(text, CHARS_PER_LINE);
    const textHeight = lines.length * LINE_HEIGHT;
    return Math.max(NODE_MIN_HEIGHT, textHeight + NODE_PADDING * 2);
  };

  const allNodes = getAllNodes(tree);
  const connections = getConnections(tree);

  return (
    <div className="tree-canvas-container" style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        style={{ cursor: isPanning ? 'grabbing' : 'grab', background: 'var(--bg-primary)' }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Connection lines */}
        <g className="connections">
          {connections.map(({ from, to }) => {
            const fromPos = nodePositions.get(from);
            const toPos = nodePositions.get(to);
            
            if (!fromPos || !toPos) return null;
            
            // Find the nodes to get their titles for height calculation
            const fromNode = allNodes.find(n => n.id === from);
            const toNode = allNodes.find(n => n.id === to);
            
            const fromHeight = fromNode ? getNodeHeight(fromNode.title) : NODE_MIN_HEIGHT;
            const toHeight = toNode ? getNodeHeight(toNode.title) : NODE_MIN_HEIGHT;
            
            return (
              <line
                key={`${from}-${to}`}
                x1={fromPos.x}
                y1={fromPos.y + fromHeight / 2}
                x2={toPos.x}
                y2={toPos.y - toHeight / 2}
                stroke={toNode?.status === TaskStatus.COMPLETED ? "var(--success)" : "var(--border-primary)"}
                strokeWidth="2"
                opacity="0.6"
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g className="nodes">
          {allNodes.map(node => {
            const position = nodePositions.get(node.id);
            if (!position) return null;

            const isEditing = editingNode === node.id;
            const isSelected = selectedNodeId === node.id;
            const nodeHeight = getNodeHeight(node.title);
            const textLines = wrapText(node.title, CHARS_PER_LINE);

            return (
              <g key={node.id}>
                {/* Node background */}
                <rect
                  x={position.x - NODE_WIDTH / 2}
                  y={position.y - nodeHeight / 2}
                  width={NODE_WIDTH}
                  height={nodeHeight}
                  fill="var(--bg-secondary)"
                  stroke={isSelected ? "var(--accent-primary)" : "var(--border-primary)"}
                  strokeWidth={isSelected ? "2" : "1"}
                  rx="8"
                  style={{ 
                    cursor: draggedNode === node.id ? 'grabbing' : 'pointer',
                    filter: draggedNode === node.id ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' : 'none'
                  }}
                  onMouseDown={(e) => handleMouseDown(e, node.id)}
                  onClick={() => handleNodeClick(node.id)}
                  onDoubleClick={() => handleNodeDoubleClick(node.id, node.title)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                />

                {/* Status indicator */}
                <circle
                  cx={position.x - NODE_WIDTH / 2 + 15}
                  cy={position.y - nodeHeight / 2 + 15}
                  r="6"
                  fill={node.status === TaskStatus.PENDING ? 'transparent' : getStatusColor(node.status)}
                  stroke={node.status === TaskStatus.PENDING ? 'var(--text-muted)' : 'none'}
                  strokeWidth={node.status === TaskStatus.PENDING ? '2' : '0'}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusCycle(node.id, node.status);
                  }}
                />

                {/* Node title */}
                {isEditing ? (
                  <foreignObject
                    x={position.x - NODE_WIDTH / 2 + 10}
                    y={position.y - nodeHeight / 2 + NODE_PADDING}
                    width={NODE_WIDTH - 20}
                    height={nodeHeight - NODE_PADDING * 2}
                  >
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleEditSubmit(node.id)}
                      onKeyDown={(e) => handleEditKeyDown(e, node.id)}
                      style={{
                        width: '100%',
                        height: '100%',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--accent-primary)',
                        color: 'var(--text-primary)',
                        padding: '4px',
                        fontSize: '15px',
                        borderRadius: '4px',
                        resize: 'none',
                        fontFamily: 'inherit',
                        lineHeight: `${LINE_HEIGHT}px`,
                      }}
                      autoFocus
                    />
                  </foreignObject>
                ) : (
                  <text
                    x={position.x}
                    y={position.y - (textLines.length - 1) * LINE_HEIGHT / 2}
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize="15"
                    fontWeight="500"
                    style={{ 
                      pointerEvents: 'none'
                    }}
                  >
                    {textLines.map((line, index) => (
                      <tspan
                        key={index}
                        x={position.x}
                        dy={index === 0 ? 0 : LINE_HEIGHT}
                        dominantBaseline={index === 0 ? 'middle' : 'auto'}
                      >
                        {line}
                      </tspan>
                    ))}
                  </text>
                )}

                {/* Add child button */}
                {hoveredNode === node.id && (
                  <>
                    <circle
                      cx={position.x + NODE_WIDTH / 2 - 15}
                      cy={position.y - nodeHeight / 2 + 15}
                      r="16"
                      fill="none"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddChild(node.id);
                      }}
                    />
                    <text
                      x={position.x + NODE_WIDTH / 2 - 15}
                      y={position.y - nodeHeight / 2 + 15}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="var(--text-muted)"
                      fontSize="18"
                      fontWeight="bold"
                      style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddChild(node.id);
                      }}
                    >
                      +
                    </text>
                  </>
                )}

                {/* Delete button (for non-root nodes) */}
                {onDeleteNode && node.id !== tree.id && hoveredNode === node.id && (
                  <>
                    <circle
                      cx={position.x + NODE_WIDTH / 2 - 15}
                      cy={position.y + nodeHeight / 2 - 15}
                      r="14"
                      fill="none"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNode(node.id);
                      }}
                    />
                    <text
                      x={position.x + NODE_WIDTH / 2 - 15}
                      y={position.y + nodeHeight / 2 - 15}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="var(--text-muted)"
                      fontSize="16"
                      fontWeight="bold"
                      style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNode(node.id);
                      }}
                    >
                      ×
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
