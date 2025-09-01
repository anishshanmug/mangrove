"""Mangrove Task Management Application.

This package provides the core functionality for managing hierarchical task trees.
"""

from .models import TaskNode, TaskStatus

__all__ = ["TaskNode", "TaskStatus"]
__version__ = "0.1.0"
