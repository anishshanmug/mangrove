import React, { useState, useEffect } from 'react';
import type { TaskNode, TaskNodeCreate } from '../types';
import { TaskStatus } from '../types';
import { taskApi } from '../api';
import { TreeCanvas } from './TreeCanvas';
import { TaskDetailsSidebar } from './TaskDetailsSidebar';
import { TreeSelector } from './TreeSelector';

interface TreeViewProps {
  className?: string;
}

export const TreeView: React.FC<TreeViewProps> = ({ className = '' }) => {
  const [tree, setTree] = useState<TaskNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Tree management state
  const [currentTreeId, setCurrentTreeId] = useState<string | null>(null);
  const [availableTrees, setAvailableTrees] = useState<string[]>([]);
  const [treesLoading, setTreesLoading] = useState(false);


  // Load available trees and current tree on component mount
  useEffect(() => {
    loadAvailableTrees();
  }, []);
  
  // Load tree when currentTreeId changes
  useEffect(() => {
    if (currentTreeId) {
      loadTree(currentTreeId);
    }
  }, [currentTreeId]);

  const loadAvailableTrees = async () => {
    setTreesLoading(true);
    setError(null);
    
    const response = await taskApi.listTrees();
    
    if (response.error) {
      setError(response.error);
    } else if (response.data) {
      setAvailableTrees(response.data.trees);
      
      // Set current tree - prefer the backend's current tree, fallback to first available, or 'default'
      if (response.data.current_tree) {
        setCurrentTreeId(response.data.current_tree);
      } else if (response.data.trees.length > 0) {
        setCurrentTreeId(response.data.trees[0]);
      } else {
        // No trees available - try to load default anyway
        setCurrentTreeId('default');
      }
    }
    
    setTreesLoading(false);
  };
  
  const loadTree = async (treeId: string) => {
    setLoading(true);
    setError(null);
    
    // Try to get the specific tree first
    const response = await taskApi.getTree(treeId);
    
    if (response.error) {
      if (response.error.includes('Tree not found') || response.error.includes('404')) {
        // Tree doesn't exist - this is expected for new trees
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

    // API call with current tree ID
    const response = await taskApi.updateTask(nodeId, updates, currentTreeId || undefined);
    
    if (response.error) {
      // Revert on error
      setError(`Failed to update task: ${response.error}`);
      if (currentTreeId) loadTree(currentTreeId); // Reload from server
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

    // API call with current tree ID
    const response = await taskApi.createTask(newNodeData, parentId, currentTreeId || undefined);
    
    if (response.error) {
      // Revert on error
      setError(`Failed to create task: ${response.error}`);
      if (currentTreeId) loadTree(currentTreeId); // Reload from server
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

    // API call with current tree ID
    const response = await taskApi.deleteTask(nodeId, currentTreeId || undefined);
    
    if (response.error) {
      // Revert on error
      setError(`Failed to delete task: ${response.error}`);
      if (currentTreeId) loadTree(currentTreeId); // Reload from server
    } else {
      // Clear any previous errors
      setError(null);
      // No need to reload - optimistic update already applied
    }
  };

  const handleNodeSelect = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  };

  const getSelectedTask = (): TaskNode | null => {
    if (!selectedNodeId || !tree) return null;

    const findTaskRecursive = (node: TaskNode): TaskNode | null => {
      if (node.id === selectedNodeId) {
        return node;
      }
      
      for (const child of node.children) {
        const found = findTaskRecursive(child);
        if (found) return found;
      }
      
      return null;
    };

    return findTaskRecursive(tree);
  };

  const handleCreateRootTask = async (treeId?: string) => {
    const targetTreeId = treeId || currentTreeId || 'default';
    const newNodeId = generateNodeId();
    const newNodeData: TaskNodeCreate = {
      id: newNodeId,
      title: 'My Tasks',
      description: 'Root task for organizing all tasks',
      status: TaskStatus.PENDING,
    };

    setLoading(true);
    // Try to create a tree first
    const treeResponse = await taskApi.createTree(targetTreeId, newNodeData);
    
    if (treeResponse.error) {
      // If tree creation fails, try creating just a task
      const taskResponse = await taskApi.createTask(newNodeData, undefined, targetTreeId);
      
      if (taskResponse.error) {
        setError(`Failed to create root task: ${taskResponse.error}`);
      } else {
        setError(null);
        // Update current tree and reload
        setCurrentTreeId(targetTreeId);
        await loadAvailableTrees();
      }
    } else {
      setError(null);
      // Update current tree and reload
      setCurrentTreeId(targetTreeId);
      await loadAvailableTrees();
    }
    setLoading(false);
  };
  
  const handleTreeChange = async (newTreeId: string) => {
    setCurrentTreeId(newTreeId);
  };
  
  const handleCreateNewTree = async () => {
    const treeName = prompt('Enter a name for the new tree:');
    if (!treeName) return;
    
    const treeId = treeName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    await handleCreateRootTask(treeId);
  };
  
  const handleDeleteTree = async (treeIdToDelete: string) => {
    try {
      setTreesLoading(true);
      
      const response = await taskApi.deleteTree(treeIdToDelete);
      
      if (response.error) {
        setError(`Failed to delete tree: ${response.error}`);
      } else {
        // Remove from available trees
        setAvailableTrees(prev => prev.filter(id => id !== treeIdToDelete));
        
        // If we deleted the current tree, switch to another one
        if (currentTreeId === treeIdToDelete) {
          const remainingTrees = availableTrees.filter(id => id !== treeIdToDelete);
          if (remainingTrees.length > 0) {
            setCurrentTreeId(remainingTrees[0]);
          } else {
            // No trees left
            setCurrentTreeId(null);
            setTree(null);
          }
        }
        
        setError(null);
      }
    } catch (err) {
      setError(`Failed to delete tree: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTreesLoading(false);
    }
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
          <button onClick={() => currentTreeId && loadTree(currentTreeId)}>Retry</button>
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
            onClick={() => handleCreateRootTask(undefined)}
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
      {/* Tree Selector */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 10,
      }}>
        <TreeSelector
          currentTreeId={currentTreeId}
          availableTrees={availableTrees}
          currentTreeName={tree?.title}
          onTreeChange={handleTreeChange}
          onCreateNewTree={handleCreateNewTree}
          onDeleteTree={handleDeleteTree}
          loading={treesLoading}
        />
      </div>

      {/* Tree Canvas */}
      <div style={{ 
        width: selectedNodeId ? 'calc(100% - 400px)' : '100%',
        height: '100%',
        transition: 'width 0.3s ease'
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

      {/* Task Details Sidebar */}
      <TaskDetailsSidebar
        task={getSelectedTask()}
        onUpdateTask={handleUpdateNode}
        onClose={() => setSelectedNodeId(null)}
      />
    </div>
  );
};
