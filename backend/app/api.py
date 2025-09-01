"""API endpoints for task tree management."""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from app.models import TaskNode
from app.schemas import (
    TaskNodeCreate, TaskNodeUpdate, TaskNodeResponse, 
    MoveTaskRequest, TaskTreeResponse
)
from app.services import task_service

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def task_node_to_response(task: TaskNode) -> TaskNodeResponse:
    """Convert TaskNode to response schema."""
    return TaskNodeResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        children=[task_node_to_response(child) for child in task.children]
    )


@router.post("/trees/{tree_id}", response_model=TaskNodeResponse)
async def create_tree(tree_id: str, root_task: TaskNodeCreate):
    """Create a new task tree with a root task."""
    root = task_service.create_tree(tree_id, root_task)
    return task_node_to_response(root)


@router.get("/trees/{tree_id}", response_model=TaskTreeResponse)
async def get_tree(tree_id: str):
    """Get the complete task tree."""
    tree = task_service.get_tree(tree_id)
    stats = task_service.get_tree_stats(tree_id)
    
    return TaskTreeResponse(
        root=task_node_to_response(tree),
        total_tasks=stats["total_tasks"],
        completed_tasks=stats["completed_tasks"],
        progress=stats["progress"]
    )


@router.get("/trees", response_model=TaskTreeResponse)
async def get_current_tree():
    """Get the current task tree."""
    tree = task_service.get_tree()
    stats = task_service.get_tree_stats()
    
    return TaskTreeResponse(
        root=task_node_to_response(tree),
        total_tasks=stats["total_tasks"],
        completed_tasks=stats["completed_tasks"],
        progress=stats["progress"]
    )


@router.post("/", response_model=TaskNodeResponse)
async def create_task(
    task_data: TaskNodeCreate,
    parent_id: Optional[str] = Query(None, description="Parent task ID"),
    tree_id: Optional[str] = Query(None, description="Tree ID")
):
    """Create a new task."""
    task = task_service.create_task(task_data, parent_id, tree_id)
    return task_node_to_response(task)


@router.get("/{task_id}", response_model=TaskNodeResponse)
async def get_task(
    task_id: str, 
    tree_id: Optional[str] = Query(None, description="Tree ID")
):
    """Get a specific task."""
    task = task_service.get_task(task_id, tree_id)
    return task_node_to_response(task)


@router.put("/{task_id}", response_model=TaskNodeResponse)
async def update_task(
    task_id: str,
    update_data: TaskNodeUpdate,
    tree_id: Optional[str] = Query(None, description="Tree ID")
):
    """Update a task."""
    task = task_service.update_task(task_id, update_data, tree_id)
    return task_node_to_response(task)


@router.post("/{task_id}/move", response_model=TaskNodeResponse)
async def move_task(
    task_id: str,
    move_data: MoveTaskRequest,
    tree_id: Optional[str] = Query(None, description="Tree ID")
):
    """Move a task to a new parent."""
    task = task_service.move_task(task_id, move_data, tree_id)
    return task_node_to_response(task)


@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    tree_id: Optional[str] = Query(None, description="Tree ID")
):
    """Delete a task and its subtree."""
    success = task_service.delete_task(task_id, tree_id)
    return {"success": success, "message": f"Task {task_id} deleted"}


@router.get("/{task_id}/subtree", response_model=TaskNodeResponse)
async def get_subtree(
    task_id: str,
    tree_id: Optional[str] = Query(None, description="Tree ID")
):
    """Get a subtree starting from a specific task."""
    subtree = task_service.get_subtree(task_id, tree_id)
    return task_node_to_response(subtree)


@router.get("/search/", response_model=List[TaskNodeResponse])
async def search_tasks(
    q: str = Query(..., description="Search query"),
    tree_id: Optional[str] = Query(None, description="Tree ID")
):
    """Search for tasks by title or description."""
    tasks = task_service.search_tasks(q, tree_id)
    return [task_node_to_response(task) for task in tasks]


@router.get("/stats/", response_model=dict)
async def get_tree_stats(tree_id: Optional[str] = Query(None, description="Tree ID")):
    """Get statistics about the task tree."""
    return task_service.get_tree_stats(tree_id)
