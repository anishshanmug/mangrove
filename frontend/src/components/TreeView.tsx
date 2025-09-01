import React, { useState, useEffect } from 'react';
import type { TaskNode, TaskNodeCreate } from '../types';
import { TaskStatus } from '../types';
import { taskApi } from '../api';
import { TreeCanvas } from './TreeCanvas';

interface TreeViewProps {
  className?: string;
}

export const TreeView: React.FC<TreeViewProps> = ({ className = '' }) => {
  const [tree, setTree] = useState<TaskNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);


  // Load the tree on component mount
  useEffect(() => {
    loadTree();
  }, []);

  const loadTree = async () => {
    setLoading(true);
    setError(null);
    
    const response = await taskApi.getCurrentTree();
    
    if (response.error) {
      if (response.error.includes('Tree not found') || response.error.includes('404')) {
        // No tree exists yet - this is expected for a fresh app
        setTree(null);
      } else {
        setError(response.error);
      }
    } else if (response.data) {
      setTree(response.data.root);
    }
    
    setLoading(false);
  };

  const generateNodeId = (): string => {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const updateNodeInTree = (nodeId: string, updates: { title?: string; status?: TaskStatus; description?: string }): TaskNode | null => {
    if (!tree) return null;

    const updateNodeRecursive = (node: TaskNode): TaskNode => {
      if (node.id === nodeId) {
        return {
          ...node,
          ...updates,
        };
      }
      
      return {
        ...node,
        children: node.children.map(updateNodeRecursive),
      };
    };

    return updateNodeRecursive(tree);
  };

  const addNodeToTree = (parentId: string, newNode: TaskNode): TaskNode | null => {
    if (!tree) return null;

    const addNodeRecursive = (node: TaskNode): TaskNode => {
      if (node.id === parentId) {
        return {
          ...node,
          children: [...node.children, newNode],
        };
      }
      
      return {
        ...node,
        children: node.children.map(addNodeRecursive),
      };
    };

    return addNodeRecursive(tree);
  };

  const removeNodeFromTree = (nodeId: string): TaskNode | null => {
    if (!tree) return null;

    const removeNodeRecursive = (node: TaskNode): TaskNode => {
      return {
        ...node,
        children: node.children
          .filter(child => child.id !== nodeId)
          .map(removeNodeRecursive),
      };
    };

    return removeNodeRecursive(tree);
  };

  const handleUpdateNode = async (nodeId: string, updates: { title?: string; status?: TaskStatus; description?: string }) => {
    // Optimistic update
    const updatedTree = updateNodeInTree(nodeId, updates);
    if (updatedTree) {
      setTree(updatedTree);
    }

    // API call with tree ID
    const response = await taskApi.updateTask(nodeId, updates, 'default');
    
    if (response.error) {
      // Revert on error
      setError(`Failed to update task: ${response.error}`);
      loadTree(); // Reload from server
    } else {
      // Clear any previous errors
      setError(null);
      // No need to reload - optimistic update already applied
    }
  };

  const handleAddChild = async (parentId: string) => {
    const newNodeId = generateNodeId();
    const newNodeData: TaskNodeCreate = {
      id: newNodeId,
      title: 'New Task',
      description: '',
      status: TaskStatus.PENDING,
    };

    // Create new node object for optimistic update
    const newNode: TaskNode = {
      id: newNodeId,
      title: 'New Task',
      description: '',
      status: TaskStatus.PENDING,
      children: [],
    };

    // Optimistic update
    const updatedTree = addNodeToTree(parentId, newNode);
    if (updatedTree) {
      setTree(updatedTree);
    }

    // API call with tree ID
    const response = await taskApi.createTask(newNodeData, parentId, 'default');
    
    if (response.error) {
      // Revert on error
      setError(`Failed to create task: ${response.error}`);
      loadTree(); // Reload from server
    } else {
      // Clear any previous errors
      setError(null);
      // No need to reload - optimistic update already applied
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!confirm('Are you sure you want to delete this task and all its subtasks?')) {
      return;
    }

    // Close sidebar if deleting selected node
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }

    // Optimistic update
    const updatedTree = removeNodeFromTree(nodeId);
    if (updatedTree) {
      setTree(updatedTree);
    }

    // API call with tree ID
    const response = await taskApi.deleteTask(nodeId, 'default');
    
    if (response.error) {
      // Revert on error
      setError(`Failed to delete task: ${response.error}`);
      loadTree(); // Reload from server
    } else {
      // Clear any previous errors
      setError(null);
      // No need to reload - optimistic update already applied
    }
  };

  const handleNodeSelect = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  };

  const handleCreateRootTask = async () => {
    const newNodeId = generateNodeId();
    const newNodeData: TaskNodeCreate = {
      id: newNodeId,
      title: 'My Tasks',
      description: 'Root task for organizing all tasks',
      status: TaskStatus.PENDING,
    };

    setLoading(true);
    // Try to create a tree first
    const treeResponse = await taskApi.createTree('default', newNodeData);
    
    if (treeResponse.error) {
      // If tree creation fails, try creating just a task
      const taskResponse = await taskApi.createTask(newNodeData, undefined, 'default');
      
      if (taskResponse.error) {
        setError(`Failed to create root task: ${taskResponse.error}`);
      } else {
        setError(null);
        loadTree(); // Reload to get the new tree
      }
    } else {
      setError(null);
      loadTree(); // Reload to get the new tree
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className={`tree-container ${className}`}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Loading tree...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`tree-container ${className}`}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--error)' }}>Error: {error}</p>
          <button onClick={() => loadTree()}>Retry</button>
        </div>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className={`tree-container ${className}`} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Welcome to Mangrove</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            Create your first task to get started
          </p>
          <button 
            onClick={handleCreateRootTask}
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-primary)'}
          >
            Create Root Task
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`tree-container ${className}`} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Floating App Title */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 10,
        background: 'rgba(45, 45, 45, 0.9)',
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--border-primary)',
        borderRadius: '12px',
        padding: '12px 16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
          Mangrove
        </h2>
      </div>

      {/* Tree Canvas */}
      <div style={{ 
        width: '100%',
        height: '100%'
      }}>
        <TreeCanvas
          tree={tree}
          onUpdateNode={handleUpdateNode}
          onAddChild={handleAddChild}
          onDeleteNode={handleDeleteNode}
          onNodeSelect={handleNodeSelect}
          selectedNodeId={selectedNodeId}
        />
      </div>
    </div>
  );
};
