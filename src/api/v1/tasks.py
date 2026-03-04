"""Task management endpoints."""
import logging
import json
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field

from src.api.v1.auth import get_current_user, UserContext, require_division

logger = logging.getLogger(__name__)
router = APIRouter()


class TaskCreate(BaseModel):
    """Create task request."""

    customer_id: str = Field(..., description="Customer ID")
    title: str = Field(..., description="Task title")
    description: str = Field(..., description="Task description")
    task_type: str = Field(..., description="Task type (follow_up, upsell, issue, check_in)")
    due_date: datetime = Field(..., description="Due date")


class TaskUpdate(BaseModel):
    """Update task request."""

    status: str = Field(..., description="Task status (pending, in_progress, completed, cancelled)")
    notes: Optional[str] = Field(None, description="Completion notes")


class TaskResponse(BaseModel):
    """Task response."""

    id: str = Field(..., description="Task ID")
    customer_id: str = Field(..., description="Customer ID")
    customer_name: str = Field(..., description="Customer name")
    title: str = Field(..., description="Task title")
    description: str = Field(..., description="Task description")
    task_type: str = Field(..., description="Task type")
    due_date: datetime = Field(..., description="Due date")
    status: str = Field(..., description="Task status")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")
    notes: Optional[str] = Field(None, description="Completion notes")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class TaskListResponse(BaseModel):
    """Task list response."""

    total: int = Field(..., description="Total tasks")
    tasks: List[TaskResponse] = Field(..., description="Task list")


def _get_supabase_client():
    """Get Supabase client for database operations."""
    from src.config import get_settings

    settings = get_settings()
    try:
        from supabase import create_client

        return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        return None


@router.get(
    "/divisions/{division_id}/reps/{rep_id}/tasks",
    response_model=TaskListResponse,
    dependencies=[Depends(require_division("division_id"))],
)
async def get_rep_tasks(
    division_id: str,
    rep_id: str,
    status: Optional[str] = Query(None, description="Filter by status"),
    due_before: Optional[datetime] = Query(None, description="Filter by due date"),
    user: UserContext = Depends(get_current_user),
) -> TaskListResponse:
    """
    Get daily task list for a specific rep.

    Args:
        division_id: Division ID
        rep_id: Rep/user ID
        status: Optional status filter (pending, in_progress, completed)
        due_before: Optional due date filter
        user: Current user context

    Returns:
        List of tasks for the rep
    """
    try:
        # Verify user has permission to view this rep's tasks
        if user.user_id != rep_id and user.role not in ["admin", "manager"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot view other reps' tasks",
            )

        supabase = _get_supabase_client()
        if not supabase:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database unavailable",
            )

        # Build query
        query = (
            supabase.table("tasks")
            .select(
                "id, customer_id, customers(name), title, description, task_type, "
                "due_date, status, completed_at, notes, created_at, updated_at"
            )
            .eq("rep_id", rep_id)
            .eq("division_id", division_id)
        )

        if status:
            query = query.eq("status", status)

        if due_before:
            query = query.lte("due_date", due_before.isoformat())

        query = query.order("due_date", desc=False)

        response = query.execute()

        tasks = []
        for task in response.data:
            tasks.append(
                TaskResponse(
                    id=task.get("id"),
                    customer_id=task.get("customer_id"),
                    customer_name=task.get("customers", {}).get("name", "Unknown"),
                    title=task.get("title"),
                    description=task.get("description"),
                    task_type=task.get("task_type"),
                    due_date=datetime.fromisoformat(task.get("due_date")),
                    status=task.get("status"),
                    completed_at=datetime.fromisoformat(task.get("completed_at"))
                    if task.get("completed_at")
                    else None,
                    notes=task.get("notes"),
                    created_at=datetime.fromisoformat(task.get("created_at")),
                    updated_at=datetime.fromisoformat(task.get("updated_at")),
                )
            )

        logger.info(
            json.dumps(
                {
                    "event": "tasks_retrieved",
                    "division_id": division_id,
                    "rep_id": rep_id,
                    "count": len(tasks),
                }
            )
        )

        return TaskListResponse(total=len(tasks), tasks=tasks)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch tasks: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch tasks",
        )


@router.post("/tasks/{task_id}/complete", response_model=TaskResponse)
async def complete_task(
    task_id: str,
    update: TaskUpdate,
    user: UserContext = Depends(get_current_user),
) -> TaskResponse:
    """
    Mark a task as complete with timestamp and notes.

    Args:
        task_id: Task ID
        update: Update with status and notes
        user: Current user context

    Returns:
        Updated task
    """
    try:
        supabase = _get_supabase_client()
        if not supabase:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database unavailable",
            )

        # Fetch task to verify ownership
        task = supabase.table("tasks").select("*").eq("id", task_id).execute()

        if not task.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )

        task_data = task.data[0]

        # Verify user can update this task
        if task_data.get("rep_id") != user.user_id and user.role not in ["admin", "manager"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot update other reps' tasks",
            )

        now = datetime.utcnow()

        # Update task
        updated = supabase.table("tasks").update(
            {
                "status": update.status,
                "notes": update.notes,
                "completed_at": now.isoformat() if update.status == "completed" else None,
                "updated_at": now.isoformat(),
            }
        ).eq("id", task_id).execute()

        if not updated.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update task",
            )

        updated_task = updated.data[0]

        logger.info(
            json.dumps(
                {
                    "event": "task_completed",
                    "task_id": task_id,
                    "rep_id": user.user_id,
                    "status": update.status,
                }
            )
        )

        return TaskResponse(
            id=updated_task.get("id"),
            customer_id=updated_task.get("customer_id"),
            customer_name="",
            title=updated_task.get("title"),
            description=updated_task.get("description"),
            task_type=updated_task.get("task_type"),
            due_date=datetime.fromisoformat(updated_task.get("due_date")),
            status=updated_task.get("status"),
            completed_at=datetime.fromisoformat(updated_task.get("completed_at"))
            if updated_task.get("completed_at")
            else None,
            notes=updated_task.get("notes"),
            created_at=datetime.fromisoformat(updated_task.get("created_at")),
            updated_at=datetime.fromisoformat(updated_task.get("updated_at")),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to complete task: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to complete task",
        )


@router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    update: TaskUpdate,
    user: UserContext = Depends(get_current_user),
) -> TaskResponse:
    """
    Update task status.

    Args:
        task_id: Task ID
        update: Update with new status and optional notes
        user: Current user context

    Returns:
        Updated task
    """
    return await complete_task(task_id, update, user)
