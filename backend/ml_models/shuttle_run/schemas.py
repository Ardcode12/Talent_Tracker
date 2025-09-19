from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ---------- USER SCHEMAS ----------
class UserBase(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    role: Optional[str] = None
    sport: Optional[str] = None
    experience: Optional[int] = None      # change from str to int
    specialization: Optional[str] = None


class UserCreate(UserBase):
    password: str

    model_config = {
        "extra": "forbid"
    }



class UserLogin(BaseModel):
    email: str
    password: str


# 🔑 Full profile schema
class UserProfile(UserBase):
    id: int
    age: Optional[int] = None
    location: Optional[str] = None
    bio: Optional[str] = None
    achievements: Optional[str] = None   # stored as JSON text
    height: Optional[str] = None
    weight: Optional[str] = None
    skills: Optional[str] = None          # stored as JSON text
    profile_image: Optional[str] = None
    profile_photo: Optional[str] = None

    model_config = {
        "from_attributes": True
    }


class AuthResponse(BaseModel):
    token: str
    user: UserProfile


# ---------- POSTS ----------
class PostBase(BaseModel):
    text: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None


class PostCreate(PostBase):
    pass


class PostUser(BaseModel):
    id: int
    name: str
    profile_photo: Optional[str]
    sport: Optional[str]
    location: Optional[str]

    model_config = {
        "from_attributes": True
    }


class PostResponse(BaseModel):
    id: int
    user: PostUser
    content: dict
    is_ai_verified: bool
    likes_count: int
    comments_count: int
    shares_count: int
    is_liked: bool = False
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


# ---------- COMMENTS ----------
class CommentBase(BaseModel):
    text: str


class CommentCreate(CommentBase):
    post_id: int


class CommentResponse(BaseModel):
    id: int
    user: PostUser
    text: str
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


# ---------- STATS, CONNECTIONS, ETC ----------
class UserStats(BaseModel):
    name: str
    profilePhoto: Optional[str]
    nationalRank: Optional[int]
    aiScore: Optional[float]
    weeklyProgress: float

    model_config = {
        "from_attributes": True
    }


class TrendingAthlete(BaseModel):
    id: int
    name: str
    profile_photo: Optional[str]
    sport: Optional[str]
    highlight_stat: str
    badge: Optional[str]

    model_config = {
        "from_attributes": True
    }


class AnnouncementResponse(BaseModel):
    id: int
    title: str
    description: str
    icon: str
    link: Optional[str]

    model_config = {
        "from_attributes": True
    }


class ConnectionSuggestion(BaseModel):
    id: int
    name: str
    profile_photo: Optional[str]
    sport: Optional[str]
    location: Optional[str]
    is_online: bool

    model_config = {
        "from_attributes": True
    }


class PerformanceDataResponse(BaseModel):
    metric_type: str
    value: float
    unit: str
    recorded_at: datetime

    model_config = {
        "from_attributes": True
    }
