#!/usr/bin/env python3
"""
Backup cleanup utility for Mangrove trees.

This script helps you manage the backup files that accumulate over time.
"""

import asyncio
import argparse
from pathlib import Path

from app.persistence import tree_persistence


def format_file_size(size_bytes: int) -> str:
    """Format file size in human readable format."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"


async def show_backup_status():
    """Show current backup status."""
    print("📁 Backup Directory Status\n")
    
    backup_dir = tree_persistence.backup_dir
    if not backup_dir.exists():
        print("No backup directory found.")
        return
    
    # Group backups by tree
    tree_backups = {}
    total_size = 0
    
    for backup_file in backup_dir.glob("*.json"):
        # Extract tree_id from filename (format: tree_id_timestamp.json)
        parts = backup_file.stem.split('_')
        if len(parts) >= 2:
            tree_id = '_'.join(parts[:-1])  # Everything except timestamp
        else:
            tree_id = "unknown"
        
        if tree_id not in tree_backups:
            tree_backups[tree_id] = []
        
        size = backup_file.stat().st_size
        mtime = backup_file.stat().st_mtime
        tree_backups[tree_id].append({
            'file': backup_file,
            'size': size,
            'mtime': mtime
        })
        total_size += size
    
    # Sort backups by modification time for each tree
    for tree_id in tree_backups:
        tree_backups[tree_id].sort(key=lambda x: x['mtime'], reverse=True)
    
    print(f"📊 Total: {len(list(backup_dir.glob('*.json')))} backup files, {format_file_size(total_size)}")
    print()
    
    for tree_id, backups in tree_backups.items():
        print(f"🌳 {tree_id}: {len(backups)} backups")
        
        # Show newest and oldest
        if backups:
            newest = backups[0]
            oldest = backups[-1]
            
            from datetime import datetime
            newest_time = datetime.fromtimestamp(newest['mtime']).strftime('%Y-%m-%d %H:%M:%S')
            oldest_time = datetime.fromtimestamp(oldest['mtime']).strftime('%Y-%m-%d %H:%M:%S')
            
            total_tree_size = sum(b['size'] for b in backups)
            
            print(f"   📅 Newest: {newest_time}")
            print(f"   📅 Oldest: {oldest_time}")
            print(f"   💾 Size: {format_file_size(total_tree_size)}")
            print()


async def cleanup_backups(tree_id: str = None, keep_count: int = 10, older_than_days: int = 7, dry_run: bool = False):
    """Clean up old backups."""
    print(f"🧹 Cleaning up backups...")
    print(f"   Tree: {'All trees' if not tree_id else tree_id}")
    print(f"   Keep: {keep_count} most recent per tree")
    print(f"   Delete: Only files older than {older_than_days} days")
    print(f"   Mode: {'DRY RUN (no files deleted)' if dry_run else 'LIVE (files will be deleted)'}")
    print()
    
    if dry_run:
        print("This is a DRY RUN - no files will actually be deleted.")
        print("Remove --dry-run flag to actually delete files.")
        print()
    
    if not dry_run:
        deleted_count = await tree_persistence.cleanup_old_backups(
            tree_id=tree_id,
            keep_count=keep_count,
            older_than_days=older_than_days
        )
        print(f"✅ Deleted {deleted_count} backup files")
    else:
        # Simulate cleanup for dry run
        import time
        cutoff_time = time.time() - (older_than_days * 24 * 60 * 60)
        would_delete = 0
        
        if tree_id:
            tree_ids = [tree_id]
        else:
            tree_ids = tree_persistence.list_tree_ids()
        
        for tid in tree_ids:
            safe_id = "".join(c for c in tid if c.isalnum() or c in "-_")
            backup_pattern = f"{safe_id}_*.json"
            
            backup_files = list(tree_persistence.backup_dir.glob(backup_pattern))
            backup_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
            
            for i, backup_file in enumerate(backup_files):
                should_delete = (
                    i >= keep_count and
                    backup_file.stat().st_mtime < cutoff_time
                )
                
                if should_delete:
                    would_delete += 1
                    print(f"   Would delete: {backup_file.name}")
        
        print(f"📊 Would delete {would_delete} backup files")


async def main():
    parser = argparse.ArgumentParser(description="Manage Mangrove tree backups")
    parser.add_argument("--status", action="store_true", help="Show backup status")
    parser.add_argument("--cleanup", action="store_true", help="Clean up old backups")
    parser.add_argument("--tree-id", help="Target specific tree (default: all trees)")
    parser.add_argument("--keep", type=int, default=10, help="Keep this many recent backups per tree (default: 10)")
    parser.add_argument("--older-than", type=int, default=7, help="Only delete backups older than N days (default: 7)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted without actually deleting")
    
    args = parser.parse_args()
    
    if args.status or (not args.cleanup):
        await show_backup_status()
    
    if args.cleanup:
        print()
        await cleanup_backups(
            tree_id=args.tree_id,
            keep_count=args.keep,
            older_than_days=args.older_than,
            dry_run=args.dry_run
        )


if __name__ == "__main__":
    asyncio.run(main())
