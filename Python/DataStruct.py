from dataclasses import dataclass
from typing import Optional

from pydantic import BaseModel, model_validator


@dataclass
class uploadResults:
    file_name: str
    status: str
    file_type: str | None = None
    size_bytes: int | None = None
    url: str | None = None
    blob_name: str | None = None
    reason: str | None = None
    content_type: str | None = None

class userCreate(BaseModel):
    user_name: str
    first_name: str
    last_name: str
    email: str
    phone: str
    role: str = "user"
    pwd: str

class userResponse(BaseModel):
    user_id: int
    user_name: str
    first_name: str
    last_name: str
    email: str
    phone: str
    role: str

class userLogin(BaseModel):
    email: Optional[str] = None
    user_name: Optional[str] = None
    pwd: str

    @model_validator(mode="after")
    def require_email_or_username(self):
        if not self.email and not self.user_name:
            raise ValueError("email or user_name is required")
        return self