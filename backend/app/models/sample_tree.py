from app.models.task_node import TaskNode


def create_sample_tree() -> TaskNode:
    root = TaskNode(id="root", title="Root Task")
    child1 = TaskNode(id="child1", title="Child 1")
    child2 = TaskNode(id="child2", title="Child 2")
    grandchild1 = TaskNode(id="grandchild1", title="Grandchild 1")
    grandchild2 = TaskNode(id="grandchild2", title="Grandchild 2")
    
    # Establish parent-child relationships
    root.add_child(child1)
    root.add_child(child2)
    child1.add_child(grandchild1)
    child1.add_child(grandchild2)
    
    return root

if __name__ == "__main__":
    tree = create_sample_tree()
    print(tree.to_dict())