"""Business logic services for task management."""

from typing import Dict, List, Optional
from fastapi import HTTPException

from app.models import TaskNode, TaskStatus
from app.schemas import TaskNodeCreate, TaskNodeUpdate, MoveTaskRequest


class TaskTreeService:
    """Service for managing task trees in memory."""
    
    def __init__(self):
        # In-memory storage - in production, you'd use a database
        self.trees: Dict[str, TaskNode] = {}
        self.current_tree_id: Optional[str] = None
    
    def create_tree(self, tree_id: str, root_task: TaskNodeCreate) -> TaskNode:
        """Create a new task tree with a root task."""
        if tree_id in self.trees:
            raise HTTPException(status_code=400, detail=f"Tree {tree_id} already exists")
        
        root = TaskNode(
            id=root_task.id,
            title=root_task.title,
            description=root_task.description,
            status=root_task.status
        )
        
        self.trees[tree_id] = root
        if self.current_tree_id is None:
            self.current_tree_id = tree_id
        
        return root
    
    def get_tree(self, tree_id: Optional[str] = None) -> TaskNode:
        """Get a task tree by ID, or the current tree if no ID provided."""
        target_id = tree_id or self.current_tree_id
        
        if target_id is None or target_id not in self.trees:
            raise HTTPException(status_code=404, detail="Tree not found")
        
        return self.trees[target_id]
    
    def create_task(self, task_data: TaskNodeCreate, parent_id: Optional[str] = None, tree_id: Optional[str] = None) -> TaskNode:
        """Create a new task in the tree."""
        tree = self.get_tree(tree_id)
        
        # Check if task ID already exists
        if tree.contains(task_data.id):
            raise HTTPException(status_code=400, detail=f"Task {task_data.id} already exists")
        
        new_task = TaskNode(
            id=task_data.id,
            title=task_data.title,
            description=task_data.description,
            status=task_data.status
        )
        
        if parent_id:
            parent = tree.find(parent_id)
            if not parent:
                raise HTTPException(status_code=404, detail=f"Parent task {parent_id} not found")
            parent.add_child(new_task)
        else:
            # Add as child of root
            tree.add_child(new_task)
        
        return new_task
    
    def get_task(self, task_id: str, tree_id: Optional[str] = None) -> TaskNode:
        """Get a specific task by ID."""
        tree = self.get_tree(tree_id)
        task = tree.find(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
        
        return task
    
    def update_task(self, task_id: str, update_data: TaskNodeUpdate, tree_id: Optional[str] = None) -> TaskNode:
        """Update an existing task."""
        task = self.get_task(task_id, tree_id)
        
        if update_data.title is not None:
            task.title = update_data.title
        if update_data.description is not None:
            task.description = update_data.description
        if update_data.status is not None:
            task.status = update_data.status
        
        return task
    
    def move_task(self, task_id: str, move_data: MoveTaskRequest, tree_id: Optional[str] = None) -> TaskNode:
        """Move a task to a new parent."""
        tree = self.get_tree(tree_id)
        task = self.get_task(task_id, tree_id)
        
        if move_data.new_parent_id:
            new_parent = tree.find(move_data.new_parent_id)
            if not new_parent:
                raise HTTPException(status_code=404, detail=f"New parent {move_data.new_parent_id} not found")
            task.move_subtree_to(new_parent, move_data.index)
        else:
            # Move to root level
            task.move_subtree_to(tree, move_data.index)
        
        return task
    
    def delete_task(self, task_id: str, tree_id: Optional[str] = None) -> bool:
        """Delete a task and its subtree."""
        tree = self.get_tree(tree_id)
        task = self.get_task(task_id, tree_id)
        
        if task is tree:
            raise HTTPException(status_code=400, detail="Cannot delete root task")
        
        if task.parent:
            task.parent.remove_child(task_id)
        
        return True
    
    def get_subtree(self, task_id: str, tree_id: Optional[str] = None) -> TaskNode:
        """Get a subtree starting from a specific task."""
        return self.get_task(task_id, tree_id)
    
    def search_tasks(self, query: str, tree_id: Optional[str] = None) -> List[TaskNode]:
        """Search for tasks by title or description."""
        tree = self.get_tree(tree_id)
        query_lower = query.lower()
        
        results = []
        for task in tree.iter_dfs():
            if (query_lower in task.title.lower() or 
                query_lower in task.description.lower()):
                results.append(task)
        
        return results
    
    def get_tree_stats(self, tree_id: Optional[str] = None) -> dict:
        """Get statistics about the task tree."""
        tree = self.get_tree(tree_id)
        
        total_tasks = tree.subtree_size()
        completed_tasks = len([t for t in tree.iter_dfs() if t.status == TaskStatus.DONE])
        progress = tree.compute_progress()
        
        return {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "pending_tasks": len([t for t in tree.iter_dfs() if t.status == TaskStatus.PENDING]),
            "in_progress_tasks": len([t for t in tree.iter_dfs() if t.status == TaskStatus.IN_PROGRESS]),
            "progress": progress,
            "leaf_count": tree.leaf_count()
        }


# Global service instance - in production, you'd use dependency injection
task_service = TaskTreeService()
