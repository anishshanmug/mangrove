# Tree Persistence System

This document explains the file-based persistence system for task trees in the Mangrove application.

## Overview

The persistence layer automatically saves task trees as JSON files in the `/trees` directory and loads them at startup. This provides long-term storage without requiring a database.

## Key Features

### 🔒 **Atomic Writes**
- Uses temporary files and atomic moves to prevent corruption
- Guarantees that files are never left in a partially written state

### 🚀 **Async Operations** 
- All file I/O is non-blocking using `asyncio.to_thread()`
- Background saving doesn't impact API response times

### 🔄 **Automatic Backups**
- Creates timestamped backups before overwriting files
- Automatic recovery from backups if main file is corrupted

### 🛡️ **Concurrency Safety**
- File locking prevents race conditions during writes
- Multiple API requests can safely modify the same tree

### 📊 **Comprehensive Error Handling**
- Graceful handling of malformed JSON files
- Detailed logging of all persistence operations
- Service continues running even if some files are corrupted

## File Structure

```
backend/
├── trees/                  # Main tree storage
│   ├── default.json       # Default tree
│   ├── project_1.json     # User tree
│   └── my_tasks.json      # Another tree
├── trees/backups/         # Automatic backups
│   ├── default_20240101_143022.json
│   └── project_1_20240101_143105.json
```

## JSON Format

Each tree is stored as a JSON file with this structure:

```json
{
  "id": "task_1756752434473_o3klhi6oi",
  "title": "My Project",
  "description": "Root task for organizing all project tasks",
  "status": "pending",
  "children": [
    {
      "id": "task_123",
      "title": "Setup Environment",
      "description": "Install dependencies and configure project",
      "status": "done",
      "children": []
    },
    {
      "id": "task_456", 
      "title": "Implement Features",
      "description": "",
      "status": "in_progress",
      "children": [
        {
          "id": "task_789",
          "title": "Feature A",
          "description": "First feature implementation",
          "status": "pending",
          "children": []
        }
      ]
    }
  ]
}
```

## Automatic Behavior

### On Application Startup
1. Scans `/trees` directory for existing JSON files
2. Loads all valid trees into memory
3. Sets the first available tree as current tree
4. Logs any corrupted files and continues with valid ones

### On Tree Modifications
- **Create Tree**: Immediately saved to disk
- **Add/Update/Move Task**: Tree automatically saved in background
- **Delete Task**: Tree automatically saved in background

### Smart Backup Logic (NEW!)
The system now uses intelligent backup creation to avoid excessive backup files:

- **First save in 5 minutes**: Creates backup
- **Subsequent saves within 5 minutes**: Skip backup, just save the tree
- **Manual override**: Can force backup creation with `create_backup=True`

This prevents backup spam while ensuring you have recovery points during active editing sessions.

### On Application Shutdown
- Force saves all trees to ensure no data loss
- Creates final backups of all modified trees

## API Endpoints

### Tree Management
- `GET /api/trees` - List all available trees
- `GET /api/trees/{tree_id}` - Get specific tree
- `POST /api/trees/{tree_id}` - Create new tree
- `DELETE /api/trees/{tree_id}` - Delete tree (with backup)

### Manual Operations
- `POST /api/save-all` - Force save all trees immediately
- `POST /api/cleanup-backups` - Clean up old backup files
- `GET /api/health` - Check persistence system health

### Backup Management
- `python cleanup_backups.py --status` - Show backup statistics
- `python cleanup_backups.py --cleanup --keep 5` - Keep only 5 recent backups per tree
- `python cleanup_backups.py --cleanup --older-than 30` - Delete backups older than 30 days

## Configuration

### Directory Customization
```python
# Use custom directory
persistence = TreePersistence(trees_dir="custom/path")
```

### Disable Auto-save
```python
# For batch operations
task_service.set_auto_save(False)
# ... perform multiple operations ...
await task_service.force_save_all()
task_service.set_auto_save(True)
```

## Error Recovery

### Corrupted JSON Files
1. System detects JSON parsing error
2. Automatically searches for recent backups
3. Loads most recent valid backup
4. Logs recovery operation
5. Continues normal operation

### Missing Files
- Service gracefully handles missing tree files
- Creates new empty trees when requested
- Never crashes due to file system issues

## Performance Considerations

### Write Performance
- Background async writes don't block API responses
- Temporary files ensure atomic operations
- File locking prevents corruption but may briefly delay concurrent writes

### Memory Usage
- All trees kept in memory for fast access
- Suitable for hundreds of trees with thousands of tasks
- For larger datasets, consider database migration

### Disk Usage
- JSON format is human-readable but not space-optimized
- Automatic backups will accumulate over time
- Consider periodic backup cleanup for production

## Migration Path

This persistence layer provides a solid foundation that can later be migrated to a database:

```python
# Future database migration
class DatabasePersistence:
    async def save_tree(self, tree_id: str, tree: TaskNode):
        # Save to database instead of file
        pass
    
    async def load_tree(self, tree_id: str) -> TaskNode:
        # Load from database instead of file
        pass
```

The `TaskTreeService` can be updated to use any persistence backend without changing the API layer.

## Testing

Run the demonstration script to see the persistence system in action:

```bash
cd backend
python example_persistence.py
```

This will create sample trees, save them to disk, load them back, and demonstrate backup functionality.
