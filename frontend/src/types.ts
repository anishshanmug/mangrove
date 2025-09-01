// Types matching the backend API schemas

export const TaskStatus = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress", 
  COMPLETED: "done",
  CANCELLED: "cancelled"
} as const;

export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];

export interface TaskNode {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  children: TaskNode[];
}

export interface TaskNodeCreate {
  id: string;
  title: string;
  description?: string;
  status?: TaskStatus;
}

export interface TaskNodeUpdate {
  title?: string;
  description?: string;
  status?: TaskStatus;
}

export interface TaskTreeResponse {
  root: TaskNode;
  total_tasks: number;
  completed_tasks: number;
  progress: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
