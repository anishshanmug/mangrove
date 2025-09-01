from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import router as task_router
from app.services import task_service
from app.models.sample_tree import create_sample_tree


def create_app() -> FastAPI:
    app = FastAPI(title="Mangrove API", description="Task tree management API")

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

    return app


app = create_app()


