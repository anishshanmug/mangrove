"""File-based persistence layer for task trees."""

import json
import os
import asyncio
import logging
from pathlib import Path
from typing import Dict, Optional, Set
from contextlib import asynccontextmanager
from datetime import datetime

from app.models.task_node import TaskNode

logger = logging.getLogger(__name__)


class TreePersistenceError(Exception):
    """Base exception for persistence operations."""
    pass


class TreePersistence:
    """Handles saving and loading task trees to/from JSON files.
    
    Features:
    - Atomic writes using temporary files
    - Async operations to avoid blocking
    - File locking to prevent concurrent writes
    - Automatic backup creation
    - Error recovery with corruption detection
    """
    
    def __init__(self, trees_dir: str = "trees"):
        self.trees_dir = Path(trees_dir)
        self.trees_dir.mkdir(exist_ok=True)
        
        # Track which files are currently being written to prevent races
        self._write_locks: Set[str] = set()
        self._lock = asyncio.Lock()
        
        # Create backup directory
        self.backup_dir = self.trees_dir / "backups"
        self.backup_dir.mkdir(exist_ok=True)
        
    def _get_tree_path(self, tree_id: str) -> Path:
        """Get the file path for a tree."""
        # Sanitize tree_id to prevent directory traversal
        safe_id = "".join(c for c in tree_id if c.isalnum() or c in "-_")
        return self.trees_dir / f"{safe_id}.json"
    
    def _get_backup_path(self, tree_id: str) -> Path:
        """Get backup file path with timestamp."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_id = "".join(c for c in tree_id if c.isalnum() or c in "-_")
        return self.backup_dir / f"{safe_id}_{timestamp}.json"
    
    def _get_temp_path(self, tree_id: str) -> Path:
        """Get temporary file path for atomic writes."""
        safe_id = "".join(c for c in tree_id if c.isalnum() or c in "-_")
        return self.trees_dir / f"{safe_id}.tmp"
    
    async def save_tree(self, tree_id: str, tree: TaskNode, create_backup: bool = None) -> None:
        """Save a tree to JSON file with atomic write operation.
        
        Args:
            tree_id: Unique identifier for the tree
            tree: The TaskNode tree to save
            create_backup: Whether to create a backup. If None, uses smart backup logic
        
        Raises:
            TreePersistenceError: If save operation fails
        """
        async with self._lock:
            if tree_id in self._write_locks:
                logger.warning(f"Skipping save for {tree_id} - write already in progress")
                return
            
            self._write_locks.add(tree_id)
        
        try:
            tree_path = self._get_tree_path(tree_id)
            temp_path = self._get_temp_path(tree_id)
            
            # Smart backup logic
            should_backup = self._should_create_backup(tree_id, tree_path, create_backup)
            if should_backup and tree_path.exists():
                backup_path = self._get_backup_path(tree_id)
                await asyncio.to_thread(self._copy_file, tree_path, backup_path)
                logger.info(f"Created backup: {backup_path}")
            
            # Serialize tree to JSON
            tree_data = tree.to_dict()
            
            # Write to temporary file first (atomic operation)
            await asyncio.to_thread(self._write_json_file, temp_path, tree_data)
            
            # Atomic move - this is the critical section
            await asyncio.to_thread(os.replace, temp_path, tree_path)
            
            logger.info(f"Successfully saved tree {tree_id} to {tree_path}")
            
        except Exception as e:
            # Clean up temp file if it exists
            if temp_path.exists():
                await asyncio.to_thread(os.unlink, temp_path)
            
            error_msg = f"Failed to save tree {tree_id}: {str(e)}"
            logger.error(error_msg)
            raise TreePersistenceError(error_msg) from e
        
        finally:
            async with self._lock:
                self._write_locks.discard(tree_id)
    
    async def load_tree(self, tree_id: str) -> Optional[TaskNode]:
        """Load a tree from JSON file.
        
        Args:
            tree_id: Unique identifier for the tree
            
        Returns:
            TaskNode tree or None if file doesn't exist
            
        Raises:
            TreePersistenceError: If load operation fails
        """
        tree_path = self._get_tree_path(tree_id)
        
        if not tree_path.exists():
            logger.info(f"Tree file not found: {tree_path}")
            return None
        
        try:
            tree_data = await asyncio.to_thread(self._read_json_file, tree_path)
            tree = TaskNode.from_dict(tree_data)
            logger.info(f"Successfully loaded tree {tree_id} from {tree_path}")
            return tree
            
        except json.JSONDecodeError as e:
            error_msg = f"Invalid JSON in tree file {tree_path}: {str(e)}"
            logger.error(error_msg)
            
            # Try to recover from backup
            backup_tree = await self._try_recover_from_backup(tree_id)
            if backup_tree:
                logger.info(f"Recovered tree {tree_id} from backup")
                return backup_tree
            
            raise TreePersistenceError(error_msg) from e
            
        except Exception as e:
            error_msg = f"Failed to load tree {tree_id}: {str(e)}"
            logger.error(error_msg)
            raise TreePersistenceError(error_msg) from e
    
    async def load_all_trees(self) -> Dict[str, TaskNode]:
        """Load all trees from the trees directory.
        
        Returns:
            Dictionary mapping tree_id to TaskNode
        """
        trees = {}
        
        # Find all JSON files in trees directory
        json_files = list(self.trees_dir.glob("*.json"))
        
        for json_file in json_files:
            tree_id = json_file.stem  # filename without extension
            try:
                tree = await self.load_tree(tree_id)
                if tree:
                    trees[tree_id] = tree
            except TreePersistenceError:
                logger.warning(f"Skipping corrupted tree file: {json_file}")
                continue
        
        logger.info(f"Loaded {len(trees)} trees from {self.trees_dir}")
        return trees
    
    async def delete_tree(self, tree_id: str, create_backup: bool = True) -> bool:
        """Delete a tree file.
        
        Args:
            tree_id: Unique identifier for the tree
            create_backup: Whether to create a backup before deletion
            
        Returns:
            True if file was deleted, False if it didn't exist
        """
        tree_path = self._get_tree_path(tree_id)
        
        if not tree_path.exists():
            return False
        
        try:
            if create_backup:
                backup_path = self._get_backup_path(tree_id)
                await asyncio.to_thread(self._copy_file, tree_path, backup_path)
                logger.info(f"Created backup before deletion: {backup_path}")
            
            await asyncio.to_thread(os.unlink, tree_path)
            logger.info(f"Deleted tree file: {tree_path}")
            return True
            
        except Exception as e:
            error_msg = f"Failed to delete tree {tree_id}: {str(e)}"
            logger.error(error_msg)
            raise TreePersistenceError(error_msg) from e
    
    def list_tree_ids(self) -> list[str]:
        """List all available tree IDs."""
        json_files = list(self.trees_dir.glob("*.json"))
        return [f.stem for f in json_files]
    
    async def cleanup_old_backups(self, tree_id: Optional[str] = None, keep_count: int = 10, older_than_days: int = 7) -> int:
        """Clean up old backup files.
        
        Args:
            tree_id: Specific tree to clean up, or None for all trees
            keep_count: Keep this many most recent backups per tree
            older_than_days: Only delete backups older than this many days
            
        Returns:
            Number of backup files deleted
        """
        import time
        
        cutoff_time = time.time() - (older_than_days * 24 * 60 * 60)
        deleted_count = 0
        
        if tree_id:
            tree_ids = [tree_id]
        else:
            tree_ids = self.list_tree_ids()
        
        for tid in tree_ids:
            safe_id = "".join(c for c in tid if c.isalnum() or c in "-_")
            backup_pattern = f"{safe_id}_*.json"
            
            backup_files = list(self.backup_dir.glob(backup_pattern))
            
            # Sort by modification time, newest first
            backup_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
            
            # Keep the most recent ones, but only delete old ones
            for i, backup_file in enumerate(backup_files):
                should_delete = (
                    i >= keep_count and  # Beyond keep count
                    backup_file.stat().st_mtime < cutoff_time  # Older than threshold
                )
                
                if should_delete:
                    try:
                        await asyncio.to_thread(backup_file.unlink)
                        deleted_count += 1
                        logger.info(f"Deleted old backup: {backup_file.name}")
                    except Exception as e:
                        logger.warning(f"Failed to delete backup {backup_file}: {e}")
        
        logger.info(f"Cleaned up {deleted_count} old backup files")
        return deleted_count
    
    async def _try_recover_from_backup(self, tree_id: str) -> Optional[TaskNode]:
        """Try to recover a tree from the most recent backup."""
        safe_id = "".join(c for c in tree_id if c.isalnum() or c in "-_")
        backup_pattern = f"{safe_id}_*.json"
        
        backup_files = list(self.backup_dir.glob(backup_pattern))
        if not backup_files:
            return None
        
        # Sort by modification time, newest first
        backup_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
        
        for backup_file in backup_files:
            try:
                tree_data = await asyncio.to_thread(self._read_json_file, backup_file)
                return TaskNode.from_dict(tree_data)
            except Exception:
                continue  # Try next backup
        
        return None
    
    def _write_json_file(self, path: Path, data: dict) -> None:
        """Write JSON data to file (blocking operation)."""
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    def _read_json_file(self, path: Path) -> dict:
        """Read JSON data from file (blocking operation)."""
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _should_create_backup(self, tree_id: str, tree_path: Path, create_backup: Optional[bool]) -> bool:
        """Determine if a backup should be created using smart logic."""
        # If explicitly set, respect the choice
        if create_backup is not None:
            return create_backup
        
        # Don't backup if file doesn't exist
        if not tree_path.exists():
            return False
        
        # Smart backup logic: only backup if significant time has passed
        # or if this is the first backup of the day
        import time
        current_time = time.time()
        file_mtime = tree_path.stat().st_mtime
        
        # Create backup if:
        # 1. File is older than 5 minutes (300 seconds), OR
        # 2. No recent backup exists (last 5 minutes)
        time_since_modification = current_time - file_mtime
        
        if time_since_modification < 300:  # Less than 5 minutes old
            # Check if we have a recent backup
            recent_backups = self._get_recent_backups(tree_id, minutes=5)
            return len(recent_backups) == 0
        
        return True  # Create backup for older files
    
    def _get_recent_backups(self, tree_id: str, minutes: int = 5) -> list[Path]:
        """Get backups created within the last N minutes."""
        import time
        safe_id = "".join(c for c in tree_id if c.isalnum() or c in "-_")
        backup_pattern = f"{safe_id}_*.json"
        
        cutoff_time = time.time() - (minutes * 60)
        
        backup_files = list(self.backup_dir.glob(backup_pattern))
        return [f for f in backup_files if f.stat().st_mtime > cutoff_time]
    
    def _copy_file(self, src: Path, dst: Path) -> None:
        """Copy file (blocking operation)."""
        import shutil
        shutil.copy2(src, dst)


# Global persistence instance
tree_persistence = TreePersistence()
