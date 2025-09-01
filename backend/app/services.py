"""Business logic services for task management."""

import asyncio
import logging
from typing import Dict, List, Optional
from fastapi import HTTPException

from app.models import TaskNode, TaskStatus
from app.schemas import TaskNodeCreate, TaskNodeUpdate, MoveTaskRequest
from app.persistence import tree_persistence, TreePersistenceError

logger = logging.getLogger(__name__)


class TaskTreeService:
    """Service for managing task trees with file persistence."""
    
    def __init__(self):
        # In-memory storage with file persistence
        self.trees: Dict[str, TaskNode] = {}
        self.current_tree_id: Optional[str] = None
        self._auto_save = True  # Enable automatic saving
        
    async def initialize(self) -> None:
        """Initialize the service by loading existing trees from disk."""
        try:
            loaded_trees = await tree_persistence.load_all_trees()
            self.trees.update(loaded_trees)
            
            # Set current tree to first available tree if none set
            if not self.current_tree_id and self.trees:
                self.current_tree_id = next(iter(self.trees.keys()))
                
            logger.info(f"Initialized service with {len(self.trees)} trees")
            
        except TreePersistenceError as e:
            logger.error(f"Failed to initialize trees from disk: {e}")
            # Continue with empty state rather than crashing
    
    async def _save_tree_async(self, tree_id: str) -> None:
        """Save a tree asynchronously if auto-save is enabled."""
        if not self._auto_save:
            return
            
        try:
            tree = self.trees.get(tree_id)
            if tree:
                await tree_persistence.save_tree(tree_id, tree)
        except TreePersistenceError as e:
            logger.error(f"Failed to save tree {tree_id}: {e}")
            # Don't raise - this is a background operation
    
    def _schedule_save(self, tree_id: str) -> None:
        """Schedule a tree save operation."""
        # Create a task to save in the background
        asyncio.create_task(self._save_tree_async(tree_id))
    
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
        
        # Save the new tree
        self._schedule_save(tree_id)
        
        return root
    
    def get_tree(self, tree_id: Optional[str] = None) -> TaskNode:
        """Get a task tree by ID, or the current tree if no ID provided."""
        target_id = tree_id or self.current_tree_id
        
        if target_id is None or target_id not in self.trees:
            raise HTTPException(status_code=404, detail="Tree not found")
        
        return self.trees[target_id]
    
    def create_task(self, task_data: TaskNodeCreate, parent_id: Optional[str] = None, tree_id: Optional[str] = None) -> TaskNode:
        """Create a new task in the tree."""
        effective_tree_id = tree_id or self.current_tree_id
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
        
        # Save the updated tree
        if effective_tree_id:
            self._schedule_save(effective_tree_id)
        
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
        effective_tree_id = tree_id or self.current_tree_id
        task = self.get_task(task_id, tree_id)
        
        if update_data.title is not None:
            task.title = update_data.title
        if update_data.description is not None:
            task.description = update_data.description
        if update_data.status is not None:
            task.status = update_data.status
        
        # Save the updated tree
        if effective_tree_id:
            self._schedule_save(effective_tree_id)
        
        return task
    
    def move_task(self, task_id: str, move_data: MoveTaskRequest, tree_id: Optional[str] = None) -> TaskNode:
        """Move a task to a new parent."""
        effective_tree_id = tree_id or self.current_tree_id
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
        
        # Save the updated tree
        if effective_tree_id:
            self._schedule_save(effective_tree_id)
        
        return task
    
    def delete_task(self, task_id: str, tree_id: Optional[str] = None) -> bool:
        """Delete a task and its subtree."""
        effective_tree_id = tree_id or self.current_tree_id
        tree = self.get_tree(tree_id)
        task = self.get_task(task_id, tree_id)
        
        if task is tree:
            raise HTTPException(status_code=400, detail="Cannot delete root task")
        
        if task.parent:
            task.parent.remove_child(task_id)
        
        # Save the updated tree
        if effective_tree_id:
            self._schedule_save(effective_tree_id)
        
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


    async def delete_tree(self, tree_id: str) -> bool:
        """Delete an entire tree."""
        if tree_id not in self.trees:
            return False
        
        # Remove from memory
        del self.trees[tree_id]
        
        # If this was the current tree, switch to another one
        if self.current_tree_id == tree_id:
            self.current_tree_id = next(iter(self.trees.keys())) if self.trees else None
        
        # Delete from disk
        try:
            await tree_persistence.delete_tree(tree_id)
        except TreePersistenceError as e:
            logger.error(f"Failed to delete tree file {tree_id}: {e}")
            # Don't raise - tree is already removed from memory
        
        return True
    
    def list_trees(self) -> List[str]:
        """List all available tree IDs."""
        return list(self.trees.keys())
    
    def set_auto_save(self, enabled: bool) -> None:
        """Enable or disable automatic saving."""
        self._auto_save = enabled
    
    async def force_save_all(self) -> None:
        """Force save all trees to disk."""
        for tree_id, tree in self.trees.items():
            try:
                await tree_persistence.save_tree(tree_id, tree)
            except TreePersistenceError as e:
                logger.error(f"Failed to save tree {tree_id}: {e}")


# Global service instance - in production, you'd use dependency injection
task_service = TaskTreeService()
