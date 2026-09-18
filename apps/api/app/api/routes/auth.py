from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import CurrentUser, SessionDependency
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.schemas.auth import AuthResponse, UserPublic, UserRegister

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister, session: SessionDependency) -> AuthResponse:
    normalized_email = str(payload.email).strip().lower()
    existing_user = await session.scalar(select(User).where(User.email == normalized_email))
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        email=normalized_email,
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        ) from exc

    await session.refresh(user)
    return AuthResponse(access_token=create_access_token(user.id), user=user)


@router.post("/login", response_model=AuthResponse)
async def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: SessionDependency,
) -> AuthResponse:
    normalized_email = form.username.strip().lower()
    user = await session.scalar(select(User).where(User.email == normalized_email))

    if user is None or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    return AuthResponse(access_token=create_access_token(user.id), user=user)


@router.get("/me", response_model=UserPublic)
async def read_current_user(current_user: CurrentUser) -> User:
    return current_user
