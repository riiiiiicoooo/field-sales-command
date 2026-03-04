"""Authentication and authorization endpoints."""
import logging
import json
from typing import Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
import jwt
from functools import wraps

logger = logging.getLogger(__name__)
router = APIRouter()


class UserContext(BaseModel):
    """User context from JWT token."""

    user_id: str
    email: str
    name: str
    division_id: str
    role: str  # admin, manager, rep, regional_director
    avatar_url: Optional[str] = None


class TokenExchangeRequest(BaseModel):
    """Supabase auth token exchange request."""

    access_token: str = Field(..., description="Supabase access token from mobile client")


class TokenExchangeResponse(BaseModel):
    """Token exchange response."""

    access_token: str = Field(..., description="API access token")
    refresh_token: str = Field(..., description="Refresh token")
    expires_in: int = Field(..., description="Token expiration in seconds")
    user: UserContext = Field(..., description="User context")


class RefreshTokenRequest(BaseModel):
    """Refresh token request."""

    refresh_token: str = Field(..., description="Refresh token from previous exchange")


_current_user: Optional[UserContext] = None


def get_current_user(request: Request) -> UserContext:
    """
    Extract and validate user context from JWT token in Authorization header.

    Raises:
        HTTPException: If token is missing, invalid, or expired
    """
    from src.config import get_settings

    settings = get_settings()
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        logger.warning("Missing Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        scheme, token = auth_header.split()
        if scheme.lower() != "bearer":
            raise ValueError("Invalid authorization scheme")
    except ValueError:
        logger.warning("Invalid Authorization header format")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header",
        )

    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )

        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("Missing user ID in token")

        # Extract custom claims if present
        user_context = UserContext(
            user_id=user_id,
            email=payload.get("email", ""),
            name=payload.get("name", ""),
            division_id=payload.get("division_id", ""),
            role=payload.get("role", "rep"),
            avatar_url=payload.get("avatar_url"),
        )

        logger.info(
            json.dumps(
                {
                    "event": "token_validated",
                    "user_id": user_id,
                    "division_id": user_context.division_id,
                    "role": user_context.role,
                }
            )
        )

        return user_context

    except jwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )


def require_role(*roles: str):
    """
    Decorator to require specific roles.

    Args:
        roles: Required roles (e.g., "admin", "manager")

    Returns:
        Dependency function that validates user role
    """

    def dependency(user: UserContext = Depends(get_current_user)) -> UserContext:
        if user.role not in roles:
            logger.warning(
                json.dumps(
                    {
                        "event": "insufficient_permissions",
                        "user_id": user.user_id,
                        "required_roles": roles,
                        "user_role": user.role,
                    }
                )
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return dependency


def require_division(division_id_param: str = "division_id"):
    """
    Decorator to validate user has access to requested division.

    Args:
        division_id_param: Name of path parameter containing division_id

    Returns:
        Dependency function that validates division access
    """

    def dependency(
        request: Request,
        user: UserContext = Depends(get_current_user),
    ) -> UserContext:
        requested_division = request.path_params.get(division_id_param)

        if requested_division and user.division_id != requested_division:
            # Allow admins and regional directors to access any division
            if user.role not in ["admin", "regional_director"]:
                logger.warning(
                    json.dumps(
                        {
                            "event": "division_access_denied",
                            "user_id": user.user_id,
                            "user_division": user.division_id,
                            "requested_division": requested_division,
                        }
                    )
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this division",
                )

        return user

    return dependency


@router.post("/auth/token-exchange", response_model=TokenExchangeResponse)
async def exchange_token(request: TokenExchangeRequest) -> TokenExchangeResponse:
    """
    Exchange Supabase auth token for API access token.

    This endpoint is called by the React Native client after Supabase
    authentication to get an API token with user context claims.

    Args:
        request: Token exchange request with Supabase access token

    Returns:
        API access token and user context

    Raises:
        HTTPException: If token validation fails
    """
    from src.config import get_settings

    settings = get_settings()

    try:
        # Verify Supabase token
        payload = jwt.decode(
            request.access_token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )

        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("Invalid Supabase token format")

        # Fetch user details from Supabase (would call Supabase API in production)
        # For now, extract from token
        user_context = UserContext(
            user_id=user_id,
            email=payload.get("email", ""),
            name=payload.get("name", ""),
            division_id=payload.get("division_id", ""),
            role=payload.get("role", "rep"),
            avatar_url=payload.get("avatar_url"),
        )

        # Create new JWT token for API
        api_token_payload = {
            "sub": user_context.user_id,
            "email": user_context.email,
            "name": user_context.name,
            "division_id": user_context.division_id,
            "role": user_context.role,
            "avatar_url": user_context.avatar_url,
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRATION_HOURS),
        }

        api_token = jwt.encode(
            api_token_payload,
            settings.SUPABASE_JWT_SECRET,
            algorithm=settings.JWT_ALGORITHM,
        )

        # Create refresh token (longer expiration)
        refresh_payload = {
            "sub": user_context.user_id,
            "type": "refresh",
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(days=30),
        }

        refresh_token = jwt.encode(
            refresh_payload,
            settings.SUPABASE_JWT_SECRET,
            algorithm=settings.JWT_ALGORITHM,
        )

        logger.info(
            json.dumps(
                {
                    "event": "token_exchanged",
                    "user_id": user_context.user_id,
                    "division_id": user_context.division_id,
                    "role": user_context.role,
                }
            )
        )

        return TokenExchangeResponse(
            access_token=api_token,
            refresh_token=refresh_token,
            expires_in=settings.JWT_EXPIRATION_HOURS * 3600,
            user=user_context,
        )

    except jwt.InvalidTokenError as e:
        logger.error(f"Supabase token validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Supabase token",
        )


@router.post("/auth/refresh", response_model=TokenExchangeResponse)
async def refresh_token(request: RefreshTokenRequest) -> TokenExchangeResponse:
    """
    Refresh API access token using refresh token.

    Args:
        request: Refresh token request

    Returns:
        New access token and updated user context

    Raises:
        HTTPException: If refresh token is invalid or expired
    """
    from src.config import get_settings

    settings = get_settings()

    try:
        payload = jwt.decode(
            request.refresh_token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )

        if payload.get("type") != "refresh":
            raise ValueError("Token is not a refresh token")

        user_id = payload.get("sub")

        # In production, fetch full user context from database
        user_context = UserContext(
            user_id=user_id,
            email="",
            name="",
            division_id="",
            role="rep",
        )

        # Create new API token
        api_token_payload = {
            "sub": user_context.user_id,
            "email": user_context.email,
            "division_id": user_context.division_id,
            "role": user_context.role,
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRATION_HOURS),
        }

        api_token = jwt.encode(
            api_token_payload,
            settings.SUPABASE_JWT_SECRET,
            algorithm=settings.JWT_ALGORITHM,
        )

        logger.info(f"Token refreshed for user {user_id}")

        return TokenExchangeResponse(
            access_token=api_token,
            refresh_token=request.refresh_token,  # Reuse refresh token
            expires_in=settings.JWT_EXPIRATION_HOURS * 3600,
            user=user_context,
        )

    except jwt.InvalidTokenError as e:
        logger.error(f"Refresh token validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )


@router.post("/auth/verify")
async def verify_token(user: UserContext = Depends(get_current_user)) -> dict:
    """
    Verify current token is valid and return user context.

    Args:
        user: Current user from token validation

    Returns:
        User context if token is valid
    """
    return {
        "valid": True,
        "user": user.model_dump(),
    }
