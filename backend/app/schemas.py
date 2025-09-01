"""Pydantic schemas for API request/response models."""

from typing import List, Optional
from pydantic import BaseModel

from app.models import TaskStatus


class TaskNodeCreate(BaseModel):
    """Schema for creating a new task node."""
    id: str
    title: str
    description: str = ""
    status: TaskStatus = TaskStatus.PENDING


class TaskNodeUpdate(BaseModel):
    """Schema for updating an existing task node."""
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None


class TaskNodeResponse(BaseModel):
    """Schema for task node API responses."""
    id: str
    title: str
    description: str
    status: TaskStatus
    children: List["TaskNodeResponse"] = []

    class Config:
        from_attributes = True


class MoveTaskRequest(BaseModel):
    """Schema for moving a task to a new parent."""
    new_parent_id: Optional[str] = None  # None means move to root level
    index: Optional[int] = None  # Position within siblings


class TaskTreeResponse(BaseModel):
    """Schema for returning complete task tree."""
    root: TaskNodeResponse
    total_tasks: int
    completed_tasks: int
    progress: float


# Update forward references for recursive model
TaskNodeResponse.model_rebuild()
