"""Offline sync endpoints for mobile client."""
import logging
import json
from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from src.api.v1.auth import get_current_user, UserContext, require_division

logger = logging.getLogger(__name__)
router = APIRouter()


class SyncOperation(BaseModel):
    """Single pending operation to sync."""

    client_id: str = Field(..., description="Unique client operation ID for idempotency")
    operation_type: str = Field(..., description="Operation type (create_task, complete_task, record_visit)")
    timestamp: datetime = Field(..., description="Operation timestamp from client")
    payload: Dict[str, Any] = Field(..., description="Operation payload")


class SyncRequest(BaseModel):
    """Bulk sync request from mobile client."""

    device_id: str = Field(..., description="Unique device ID")
    operations: List[SyncOperation] = Field(..., description="Pending operations to sync")


class SyncOperationResult(BaseModel):
    """Result for single sync operation."""

    client_id: str = Field(..., description="Client operation ID")
    operation_type: str = Field(..., description="Operation type")
    success: bool = Field(..., description="Success status")
    server_id: Optional[str] = Field(None, description="Server-generated ID if created")
    error: Optional[str] = Field(None, description="Error message if failed")


class SyncResponse(BaseModel):
    """Sync response."""

    total_operations: int = Field(..., description="Total operations processed")
    successful: int = Field(..., description="Successful operations")
    failed: int = Field(..., description="Failed operations")
    results: List[SyncOperationResult] = Field(..., description="Results for each operation")
    server_time: datetime = Field(..., description="Server timestamp")


def _get_supabase_client():
    """Get Supabase client."""
    from src.config import get_settings

    settings = get_settings()
    try:
        from supabase import create_client

        return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        return None


async def _process_sync_operation(
    operation: SyncOperation,
    division_id: str,
    user_id: str,
) -> SyncOperationResult:
    """
    Process single sync operation.

    Uses client_id + timestamp for idempotency to prevent duplicates
    if client retries due to network errors.

    Args:
        operation: Operation to process
        division_id: Division ID
        user_id: User ID

    Returns:
        Operation result
    """
    supabase = _get_supabase_client()
    if not supabase:
        return SyncOperationResult(
            client_id=operation.client_id,
            operation_type=operation.operation_type,
            success=False,
            error="Database unavailable",
        )

    try:
        # Check if operation already processed (idempotency)
        existing = (
            supabase.table("sync_queue")
            .select("id, status")
            .eq("device_id", operation.client_id)
            .eq("operation_type", operation.operation_type)
            .gte("created_at", operation.timestamp.isoformat())
            .execute()
        )

        if existing.data:
            # Operation already synced
            return SyncOperationResult(
                client_id=operation.client_id,
                operation_type=operation.operation_type,
                success=True,
                server_id=existing.data[0].get("id"),
            )

        # Process operation
        result_id = None

        if operation.operation_type == "create_task":
            # Create task
            task_data = {
                "rep_id": user_id,
                "division_id": division_id,
                "customer_id": operation.payload.get("customer_id"),
                "title": operation.payload.get("title"),
                "description": operation.payload.get("description"),
                "task_type": operation.payload.get("task_type"),
                "due_date": operation.payload.get("due_date"),
                "status": "pending",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }

            task_result = supabase.table("tasks").insert(task_data).execute()
            result_id = task_result.data[0].get("id") if task_result.data else None

        elif operation.operation_type == "complete_task":
            # Complete task
            task_update = {
                "status": operation.payload.get("status", "completed"),
                "notes": operation.payload.get("notes"),
                "completed_at": datetime.utcnow().isoformat() if operation.payload.get("status") == "completed" else None,
                "updated_at": datetime.utcnow().isoformat(),
            }

            supabase.table("tasks").update(task_update).eq("id", operation.payload.get("task_id")).execute()
            result_id = operation.payload.get("task_id")

        elif operation.operation_type == "record_visit":
            # Record visit
            visit_data = {
                "rep_id": user_id,
                "division_id": division_id,
                "customer_id": operation.payload.get("customer_id"),
                "latitude": operation.payload.get("latitude"),
                "longitude": operation.payload.get("longitude"),
                "accuracy_meters": operation.payload.get("accuracy_meters", 0),
                "started_at": operation.payload.get("started_at"),
                "ended_at": operation.payload.get("ended_at"),
                "duration_minutes": operation.payload.get("duration_minutes"),
                "tasks_completed": operation.payload.get("tasks_completed", 0),
                "revenue_generated": operation.payload.get("revenue_generated", 0),
                "notes": operation.payload.get("notes"),
                "created_at": datetime.utcnow().isoformat(),
            }

            visit_result = supabase.table("visits").insert(visit_data).execute()
            result_id = visit_result.data[0].get("id") if visit_result.data else None

        else:
            return SyncOperationResult(
                client_id=operation.client_id,
                operation_type=operation.operation_type,
                success=False,
                error=f"Unknown operation type: {operation.operation_type}",
            )

        # Log operation to sync_queue
        supabase.table("sync_queue").insert(
            {
                "device_id": operation.client_id,
                "operation_type": operation.operation_type,
                "payload": operation.payload,
                "status": "synced",
                "created_at": datetime.utcnow().isoformat(),
                "synced_at": datetime.utcnow().isoformat(),
            }
        ).execute()

        return SyncOperationResult(
            client_id=operation.client_id,
            operation_type=operation.operation_type,
            success=True,
            server_id=result_id,
        )

    except Exception as e:
        logger.error(f"Failed to process sync operation {operation.operation_type}: {e}")
        return SyncOperationResult(
            client_id=operation.client_id,
            operation_type=operation.operation_type,
            success=False,
            error=str(e),
        )


@router.post(
    "/divisions/{division_id}/sync",
    response_model=SyncResponse,
    dependencies=[Depends(require_division("division_id"))],
)
async def sync_offline_queue(
    division_id: str,
    sync_request: SyncRequest,
    user: UserContext = Depends(get_current_user),
) -> SyncResponse:
    """
    Sync pending operations from mobile client.

    Handles offline queue synchronization with idempotency to prevent
    duplicate operations if client retries. Supports:
    - Create task
    - Complete task
    - Record visit

    Args:
        division_id: Division ID
        sync_request: Batch of pending operations
        user: Current user context

    Returns:
        Sync results with status for each operation
    """
    from src.config import get_settings

    settings = get_settings()

    try:
        # Validate batch size
        if len(sync_request.operations) > settings.MAX_SYNC_BATCH_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Too many operations. Max: {settings.MAX_SYNC_BATCH_SIZE}",
            )

        logger.info(
            json.dumps(
                {
                    "event": "sync_started",
                    "division_id": division_id,
                    "device_id": sync_request.device_id,
                    "operation_count": len(sync_request.operations),
                }
            )
        )

        # Process operations
        results = []
        successful = 0
        failed = 0

        for operation in sync_request.operations:
            result = await _process_sync_operation(operation, division_id, user.user_id)
            results.append(result)

            if result.success:
                successful += 1
            else:
                failed += 1

        response = SyncResponse(
            total_operations=len(sync_request.operations),
            successful=successful,
            failed=failed,
            results=results,
            server_time=datetime.utcnow(),
        )

        logger.info(
            json.dumps(
                {
                    "event": "sync_completed",
                    "division_id": division_id,
                    "device_id": sync_request.device_id,
                    "successful": successful,
                    "failed": failed,
                }
            )
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Sync failed",
        )
