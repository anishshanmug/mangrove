import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.api import router as task_router
from app.services import task_service
from app.models.sample_tree import create_sample_tree

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown."""
    # Startup
    logger.info("Starting Mangrove API...")
    
    # Initialize the task service with persisted trees
    await task_service.initialize()
    
    # Load default tree if no trees exist
    if not task_service.list_trees():
        logger.info("No existing trees found, checking for default.json...")
        try:
            from app.persistence import tree_persistence
            default_tree = await tree_persistence.load_tree("default")
            if default_tree:
                task_service.trees["default"] = default_tree
                task_service.current_tree_id = "default"
                logger.info("Loaded default tree from default.json")
        except Exception as e:
            logger.warning(f"Could not load default tree: {e}")
    
    logger.info(f"Service initialized with {len(task_service.list_trees())} trees")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Mangrove API...")
    try:
        await task_service.force_save_all()
        logger.info("All trees saved to disk")
    except Exception as e:
        logger.error(f"Error saving trees during shutdown: {e}")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Mangrove API", 
        description="Task tree management API",
        lifespan=lifespan
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include task management routes
    app.include_router(task_router)

    @app.get("/api/health")
    async def health_check() -> dict:
        return {"status": "ok"}

    @app.get("/api/hello")
    async def hello() -> dict:
        return {"message": "Hello from FastAPI"}

    @app.post("/api/sample-tree")
    async def create_sample_tree_endpoint() -> dict:
        """Create a sample task tree for testing."""
        sample_tree = create_sample_tree()
        
        # Convert to our service format
        from app.schemas import TaskNodeCreate
        root_data = TaskNodeCreate(
            id=sample_tree.id,
            title=sample_tree.title,
            description=sample_tree.description,
            status=sample_tree.status
        )
        
        # Create tree in service
        tree_id = "sample"
        root = task_service.create_tree(tree_id, root_data)
        
        # Add children
        for child in sample_tree.children:
            child_data = TaskNodeCreate(
                id=child.id,
                title=child.title,
                description=child.description,
                status=child.status
            )
            child_task = task_service.create_task(child_data, root.id, tree_id)
            
            # Add grandchildren
            for grandchild in child.children:
                grandchild_data = TaskNodeCreate(
                    id=grandchild.id,
                    title=grandchild.title,
                    description=grandchild.description,
                    status=grandchild.status
                )
                task_service.create_task(grandchild_data, child.id, tree_id)
        
        return {"message": "Sample tree created", "tree_id": tree_id}
    
    @app.get("/api/trees")
    async def list_trees() -> dict:
        """List all available trees."""
        trees = task_service.list_trees()
        return {
            "trees": trees,
            "current_tree": task_service.current_tree_id,
            "count": len(trees)
        }
    
    @app.delete("/api/trees/{tree_id}")
    async def delete_tree(tree_id: str) -> dict:
        """Delete a tree."""
        success = await task_service.delete_tree(tree_id)
        if not success:
            raise HTTPException(status_code=404, detail=f"Tree {tree_id} not found")
        return {"message": f"Tree {tree_id} deleted"}
    
    @app.post("/api/save-all")
    async def save_all_trees() -> dict:
        """Manually save all trees to disk."""
        try:
            await task_service.force_save_all()
            return {"message": "All trees saved successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save trees: {str(e)}")
    
    @app.post("/api/cleanup-backups")
    async def cleanup_backups(
        tree_id: str = None,
        keep_count: int = 10,
        older_than_days: int = 7
    ) -> dict:
        """Clean up old backup files."""
        try:
            from app.persistence import tree_persistence
            deleted_count = await tree_persistence.cleanup_old_backups(
                tree_id=tree_id,
                keep_count=keep_count,
                older_than_days=older_than_days
            )
            return {
                "message": f"Cleaned up {deleted_count} backup files",
                "deleted_count": deleted_count,
                "tree_id": tree_id or "all trees",
                "keep_count": keep_count,
                "older_than_days": older_than_days
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to cleanup backups: {str(e)}")

    return app


app = create_app()
