// API utilities for communicating with the backend

import type { TaskNode, TaskNodeCreate, TaskNodeUpdate, TaskTreeResponse, TreeInfo, ApiResponse } from './types';

const API_BASE = '/api';

async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export const taskApi = {
  // Get the current tree (try default first, fallback to specific tree)
  async getCurrentTree(treeId: string = 'default'): Promise<ApiResponse<TaskTreeResponse>> {
    // First try the general endpoint
    const generalResponse = await apiCall<TaskTreeResponse>('/tasks/trees');
    if (!generalResponse.error) {
      return generalResponse;
    }
    
    // If that fails, try with a specific tree ID
    return apiCall<TaskTreeResponse>(`/tasks/trees/${treeId}`);
  },

  // Create a new tree with root task
  async createTree(treeId: string, rootTask: TaskNodeCreate): Promise<ApiResponse<TaskNode>> {
    return apiCall<TaskNode>(`/tasks/trees/${treeId}`, {
      method: 'POST',
      body: JSON.stringify(rootTask),
    });
  },

  // Create a new task
  async createTask(taskData: TaskNodeCreate, parentId?: string, treeId?: string): Promise<ApiResponse<TaskNode>> {
    const queryParams = new URLSearchParams();
    if (parentId) queryParams.append('parent_id', parentId);
    if (treeId) queryParams.append('tree_id', treeId);
    
    const queryString = queryParams.toString();
    const url = queryString ? `/tasks?${queryString}` : '/tasks';
    
    return apiCall<TaskNode>(url, {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  },

  // Update a task
  async updateTask(taskId: string, updateData: TaskNodeUpdate, treeId?: string): Promise<ApiResponse<TaskNode>> {
    const queryParams = treeId ? `?tree_id=${treeId}` : '';
    return apiCall<TaskNode>(`/tasks/${taskId}${queryParams}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  },

  // Delete a task
  async deleteTask(taskId: string, treeId?: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    const queryParams = treeId ? `?tree_id=${treeId}` : '';
    return apiCall(`/tasks/${taskId}${queryParams}`, {
      method: 'DELETE',
    });
  },

  // Get tree stats
  async getTreeStats(treeId?: string): Promise<ApiResponse<{ total_tasks: number; completed_tasks: number; progress: number }>> {
    const queryParams = treeId ? `?tree_id=${treeId}` : '';
    return apiCall(`/tasks/stats${queryParams}`);
  },

  // List all available trees
  async listTrees(): Promise<ApiResponse<TreeInfo>> {
    return apiCall<TreeInfo>('/trees');
  },

  // Get a specific tree by ID
  async getTree(treeId: string): Promise<ApiResponse<TaskTreeResponse>> {
    return apiCall<TaskTreeResponse>(`/tasks/trees/${treeId}`);
  },

  // Delete a tree
  async deleteTree(treeId: string): Promise<ApiResponse<{ message: string }>> {
    return apiCall(`/trees/${treeId}`, {
      method: 'DELETE',
    });
  },
};
