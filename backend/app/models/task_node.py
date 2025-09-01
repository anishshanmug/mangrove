from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, Iterable, Iterator, List, Optional


class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    CANCELLED = "cancelled"


@dataclass
class TaskNode:
    """A tree node representing a task and its nested subtasks.

    The node holds identity, descriptive fields, status, and child nodes.
    Supports typical tree operations (add/remove/move), safety checks to
    prevent cycles, progress computation, and dict-based serialization.
    """

    id: str
    title: str
    description: str = ""
    status: TaskStatus = TaskStatus.PENDING
    parent: Optional["TaskNode"] = field(default=None, repr=False, compare=False, init=False)
    children: List["TaskNode"] = field(default_factory=list)

    # ----- Mutations -----
    def add_child(self, child: "TaskNode", index: Optional[int] = None) -> None:
        """Attach an existing node as a child, preventing cycles.

        If `index` is provided, inserts at that 0-based position; otherwise appends.
        """
        if child is self:
            raise ValueError("A node cannot be a child of itself")
        if self.contains(child.id):
            raise ValueError(f"Child with id {child.id} already in subtree")
        if self.is_descendant_of(child):
            raise ValueError("Cannot add ancestor as a child (cycle)")
        # Detach child from its current parent first
        child.detach()
        child.parent = self
        if index is None or index >= len(self.children):
            self.children.append(child)
        else:
            if index < 0:
                index = 0
            self.children.insert(index, child)

    def add_children(self, children: Iterable["TaskNode"]) -> None:
        for child in children:
            self.add_child(child)

    def remove_child(self, child_id: str) -> "TaskNode":
        """Detach and return the child with the given id.

        Raises KeyError if not found.
        """
        for index, child in enumerate(self.children):
            if child.id == child_id:
                removed = self.children.pop(index)
                removed.parent = None
                return removed
        raise KeyError(f"Child {child_id} not found")

    def detach(self) -> None:
        """Detach this node from its parent, if any."""
        if self.parent is None:
            return
        parent = self.parent
        self.parent = None
        # Remove by identity
        for index, child in enumerate(parent.children):
            if child is self:
                parent.children.pop(index)
                break

    def move_subtree_to(self, new_parent: "TaskNode", index: Optional[int] = None) -> None:
        """Move this subtree under a new parent, preserving identity.

        This method must be called on a node that is already part of a tree.
        The current parent (if any) will drop the node; then the new parent
        will attach it. Cycle safety is enforced by `add_child`.
        """
        if new_parent is self:
            raise ValueError("Cannot move a node under itself")
        if self.contains(new_parent.id):
            raise ValueError("Cannot move a node under its descendant (cycle)")
        self.detach()
        new_parent.add_child(self, index=index)

    # ----- Queries -----
    def contains(self, node_id: str) -> bool:
        """Return True if a node with `node_id` exists in the subtree."""
        if self.id == node_id:
            return True
        for child in self.children:
            if child.contains(node_id):
                return True
        return False

    def find(self, node_id: str) -> Optional["TaskNode"]:
        """Depth-first search for a node by id in the subtree."""
        if self.id == node_id:
            return self
        for child in self.children:
            found = child.find(node_id)
            if found is not None:
                return found
        return None

    def find_ancestor(self, ancestor_id: str) -> Optional["TaskNode"]:
        """Find an ancestor by id using parent pointers."""
        current: Optional[TaskNode] = self.parent
        while current is not None:
            if current.id == ancestor_id:
                return current
            current = current.parent
        return None

    def get_root(self) -> "TaskNode":
        """Return the root node by walking up via parent pointers."""
        current: TaskNode = self
        while current.parent is not None:
            current = current.parent
        return current

    def is_leaf(self) -> bool:
        return len(self.children) == 0

    def depth(self) -> int:
        d = 0
        current: Optional[TaskNode] = self.parent
        while current is not None:
            d += 1
            current = current.parent
        return d

    def path_to_root(self) -> List["TaskNode"]:
        """Return a list of nodes from self up to the root (inclusive)."""
        path: List[TaskNode] = []
        current: Optional[TaskNode] = self
        while current is not None:
            path.append(current)
            current = current.parent
        return path

    def subtree_size(self) -> int:
        return sum(1 for _ in self.iter_dfs())

    def leaf_count(self) -> int:
        return sum(1 for node in self.iter_dfs() if node.is_leaf())

    def iter_dfs(self) -> Iterator["TaskNode"]:
        """Yield nodes in pre-order depth-first traversal."""
        yield self
        for child in self.children:
            yield from child.iter_dfs()

    def filter(self, predicate: Callable[["TaskNode"], bool]) -> List["TaskNode"]:
        return [node for node in self.iter_dfs() if predicate(node)]

    def is_ancestor_of(self, other: "TaskNode") -> bool:
        current: Optional[TaskNode] = other.parent
        while current is not None:
            if current is self:
                return True
            current = current.parent
        return False

    def is_descendant_of(self, other: "TaskNode") -> bool:
        return other.is_ancestor_of(self)

    # ----- Computations -----
    def compute_progress(self) -> float:
        """Compute progress in [0,1] based on leaf statuses.

        Rules:
        - If no children: DONE -> 1.0, IN_PROGRESS -> 0.5, PENDING -> 0.0
        - If has children: average of children's progress
        """
        if not self.children:
            if self.status == TaskStatus.DONE:
                return 1.0
            if self.status == TaskStatus.IN_PROGRESS:
                return 0.5
            return 0.0
        total = 0.0
        count = 0
        for child in self.children:
            total += child.compute_progress()
            count += 1
        return total / count if count else 0.0

    # ----- Identity -----
    def __eq__(self, other: object) -> bool:
        if not isinstance(other, TaskNode):
            return False
        return self.id == other.id

    def __hash__(self) -> int:
        return hash(self.id)

    # ----- Serialization -----
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status.value,
            "children": [child.to_dict() for child in self.children],
        }

    # ----- Deserialization ----- (Example use: TaskNode.from_dict(json.loads(json_str)))
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TaskNode":
        node = cls(
            id=str(data["id"]),
            title=str(data.get("title", "")),
            description=str(data.get("description", "")),
            status=TaskStatus(str(data.get("status", TaskStatus.PENDING.value))),
        )
        children_data = data.get("children", []) or []
        for child_dict in children_data:
            child = cls.from_dict(child_dict)
            node.add_child(child)
        return node


