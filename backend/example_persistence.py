#!/usr/bin/env python3
"""
Example script demonstrating the tree persistence system.

This script shows how trees are automatically saved and loaded.
"""

import asyncio
import json
from pathlib import Path

from app.models.task_node import TaskNode, TaskStatus
from app.persistence import tree_persistence


async def main():
    """Demonstrate the persistence functionality."""
    
    print("🌳 Tree Persistence Demo\n")
    
    # Create a sample tree
    print("1. Creating a sample tree...")
    root = TaskNode(
        id="demo_root", 
        title="Demo Project", 
        description="A sample project to demonstrate persistence"
    )
    
    # Add some tasks
    task1 = TaskNode(
        id="task_1", 
        title="Setup Environment", 
        status=TaskStatus.DONE
    )
    
    task2 = TaskNode(
        id="task_2", 
        title="Implement Features", 
        status=TaskStatus.IN_PROGRESS
    )
    
    subtask1 = TaskNode(
        id="subtask_1", 
        title="Feature A", 
        status=TaskStatus.DONE
    )
    
    subtask2 = TaskNode(
        id="subtask_2", 
        title="Feature B", 
        status=TaskStatus.PENDING
    )
    
    # Build tree structure
    root.add_child(task1)
    root.add_child(task2)
    task2.add_child(subtask1)
    task2.add_child(subtask2)
    
    print(f"   Created tree with {root.subtree_size()} tasks")
    print(f"   Progress: {root.compute_progress():.1%}")
    
    # Save the tree
    print("\n2. Saving tree to disk...")
    tree_id = "demo_project"
    await tree_persistence.save_tree(tree_id, root)
    
    # Check that file was created
    tree_path = tree_persistence._get_tree_path(tree_id)
    print(f"   ✅ Tree saved to: {tree_path}")
    print(f"   File size: {tree_path.stat().st_size} bytes")
    
    # Show the JSON structure
    print(f"\n3. Tree JSON structure:")
    with open(tree_path, 'r') as f:
        tree_data = json.load(f)
    print(json.dumps(tree_data, indent=2))
    
    # Load the tree back
    print("\n4. Loading tree from disk...")
    loaded_tree = await tree_persistence.load_tree(tree_id)
    
    if loaded_tree:
        print(f"   ✅ Tree loaded successfully!")
        print(f"   Root title: {loaded_tree.title}")
        print(f"   Tree size: {loaded_tree.subtree_size()} tasks")
        print(f"   Progress: {loaded_tree.compute_progress():.1%}")
        
        # Verify structure is identical
        original_dict = root.to_dict()
        loaded_dict = loaded_tree.to_dict()
        
        if original_dict == loaded_dict:
            print("   ✅ Loaded tree matches original perfectly!")
        else:
            print("   ❌ Tree structure mismatch!")
    
    # Test backup functionality
    print("\n5. Testing backup creation...")
    
    # Modify the tree
    new_task = TaskNode(id="task_3", title="Testing", status=TaskStatus.PENDING)
    loaded_tree.add_child(new_task)
    
    # Save again (this will create a backup)
    await tree_persistence.save_tree(tree_id, loaded_tree, create_backup=True)
    
    # List backup files
    backup_dir = tree_persistence.backup_dir
    backups = list(backup_dir.glob(f"{tree_id}_*.json"))
    print(f"   ✅ Created {len(backups)} backup(s)")
    
    if backups:
        latest_backup = max(backups, key=lambda f: f.stat().st_mtime)
        print(f"   Latest backup: {latest_backup.name}")
    
    # Test loading all trees
    print("\n6. Testing bulk load...")
    all_trees = await tree_persistence.load_all_trees()
    print(f"   ✅ Loaded {len(all_trees)} tree(s) from disk")
    
    for tid, tree in all_trees.items():
        print(f"   - {tid}: {tree.title} ({tree.subtree_size()} tasks)")
    
    print("\n🎉 Persistence demo completed successfully!")
    print(f"\nFiles created in: {tree_persistence.trees_dir}")
    print(f"Backups stored in: {tree_persistence.backup_dir}")


if __name__ == "__main__":
    asyncio.run(main())
