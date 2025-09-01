import React, { useState, useEffect } from 'react';
import type { TaskNode, TaskStatus } from '../types';
import { TaskStatus as TaskStatusValues } from '../types';

interface TaskDetailsSidebarProps {
  task: TaskNode | null;
  onUpdateTask: (taskId: string, updates: { title?: string; status?: TaskStatus; description?: string }) => void;
  onClose: () => void;
}

export const TaskDetailsSidebar: React.FC<TaskDetailsSidebarProps> = ({
  task,
  onUpdateTask,
  onClose,
}) => {
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (task) {
      setDescription(task.description || '');
    }
  }, [task]);

  if (!task) return null;

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  };

  const handleDescriptionBlur = () => {
    if (description !== task.description) {
      onUpdateTask(task.id, { description });
    }
  };

  const handleDescriptionKeyDown = (e: React.KeyEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      if (description !== task.description) {
        onUpdateTask(task.id, { description });
      }
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: '400px',
      height: '100%',
      backgroundColor: 'var(--bg-secondary)',
      borderLeft: '1px solid var(--border-primary)',
      boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.3)',
      zIndex: 20,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid var(--border-primary)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <h3 style={{ 
          margin: 0, 
          color: 'var(--text-primary)', 
          fontSize: '1.1rem',
          fontWeight: '600'
        }}>
          Task Details
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '1.2rem',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            transition: 'background-color 0.2s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div style={{
        padding: '20px 20px 20px 20px',
        paddingRight: '20px',
        flex: 1,
        overflow: 'auto',
      }}>
        {/* Title */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
            fontWeight: '500',
          }}>
            Title
          </label>
          <div style={{
            padding: '12px',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-primary)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            fontSize: '0.9rem',
            width: 'calc(100% - 40px)',
            maxWidth: '280px',
          }}>
            {task.title}
          </div>
        </div>

        {/* Status */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '12px',
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
            fontWeight: '500',
          }}>
            Status
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            columnGap: '3px',
            rowGap: '8px',
            marginRight: '40px',
          }}>
            {[
              { value: TaskStatusValues.PENDING, label: 'Pending', color: 'var(--text-muted)' },
              { value: TaskStatusValues.IN_PROGRESS, label: 'In Progress', color: 'var(--warning)' },
              { value: TaskStatusValues.COMPLETED, label: 'Done', color: 'var(--success)' },
              { value: TaskStatusValues.CANCELLED, label: 'Cancelled', color: 'var(--error)' },
            ].map((status, index) => (
              <button
                key={status.value}
                onClick={() => onUpdateTask(task.id, { status: status.value })}
                style={{
                  padding: '8px 4px',
                  border: `1px solid ${task.status === status.value ? status.color : 'var(--border-primary)'}`,
                  borderRadius: '12px',
                  backgroundColor: 'transparent',
                  color: task.status === status.value ? status.color : 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  width: '80%',
                  // Move right column buttons (In Progress, Cancelled) to the left within their cells
                  justifySelf: index % 2 === 1 ? 'start' : 'end',
                }}
                onMouseEnter={(e) => {
                  if (task.status !== status.value) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (task.status !== status.value) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
            fontWeight: '500',
          }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={handleDescriptionChange}
            onBlur={handleDescriptionBlur}
            onKeyDown={handleDescriptionKeyDown}
            placeholder="Add a description..."
            style={{
              width: 'calc(100% - 40px)',
              maxWidth: '280px',
              height: '120px',
              padding: '12px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-primary)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: '1.5',
            }}
          />
          <div style={{
            marginTop: '6px',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}>
            Press Ctrl+Enter to save
          </div>
        </div>
      </div>
    </div>
  );
};
