from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_access_token
from app.db import get_db_session
from app.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_v1_prefix}/auth/login")
SessionDependency = Annotated[AsyncSession, Depends(get_db_session)]
TokenDependency = Annotated[str, Depends(oauth2_scheme)]


async def get_current_user(session: SessionDependency, token: TokenDependency) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        user_id = decode_access_token(token)
    except (jwt.InvalidTokenError, ValueError, TypeError) as exc:
        raise credentials_error from exc

    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        raise credentials_error
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
