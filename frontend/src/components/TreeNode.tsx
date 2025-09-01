import React, { useState, useRef } from 'react';
import type { TaskNode } from '../types';
import { TaskStatus } from '../types';

interface TreeNodeProps {
  node: TaskNode;
  onUpdateNode: (nodeId: string, updates: { title?: string; status?: TaskStatus }) => void;
  onAddChild: (parentId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  level?: number;
}

export const TreeNodeComponent: React.FC<TreeNodeProps> = ({
  node,
  onUpdateNode,
  onAddChild,
  onDeleteNode,
  level = 0,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(node.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleTitleClick = () => {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleTitleSubmit = () => {
    if (title.trim() !== node.title) {
      onUpdateNode(node.id, { title: title.trim() });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setTitle(node.title);
      setIsEditing(false);
    }
  };

  const handleAddChild = () => {
    onAddChild(node.id);
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
        return 'var(--text-muted)';
    }
  };

  const handleStatusToggle = () => {
    const nextStatus = node.status === TaskStatus.COMPLETED 
      ? TaskStatus.PENDING 
      : TaskStatus.COMPLETED;
    onUpdateNode(node.id, { status: nextStatus });
  };

  return (
    <div className="tree-node">
      <div className="node-content">
        {/* Status indicator */}
        <div 
          className="status-indicator"
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: node.status === TaskStatus.PENDING ? 'transparent' : getStatusColor(node.status),
            border: node.status === TaskStatus.PENDING ? '2px solid var(--text-muted)' : 'none',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          onClick={handleStatusToggle}
          title={`Status: ${node.status} (click to toggle)`}
        />

        {/* Title input */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={handleTitleChange}
            onBlur={handleTitleSubmit}
            onKeyDown={handleKeyDown}
            className="node-title-input"
            style={{ width: '100%' }}
          />
        ) : (
          <span
            className="node-title-display"
            onClick={handleTitleClick}
            style={{
              flex: 1,
              cursor: 'text',
              color: node.status === TaskStatus.COMPLETED ? 'var(--text-muted)' : 'var(--text-primary)'
            }}
          >
            {node.title}
          </span>
        )}

        {/* Add child button */}
        <button
          className="add-node-btn"
          onClick={handleAddChild}
          title="Add child task"
        >
          +
        </button>

        {/* Delete button (optional) */}
        {onDeleteNode && level > 0 && (
          <button
            className="delete-node-btn"
            onClick={() => onDeleteNode(node.id)}
            title="Delete task"
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8rem',
              padding: 0,
              backgroundColor: 'var(--error)',
              border: 'none',
              color: 'white',
              marginLeft: '0.25rem',
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Children */}
      {node.children && node.children.length > 0 && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              onUpdateNode={onUpdateNode}
              onAddChild={onAddChild}
              onDeleteNode={onDeleteNode}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};
