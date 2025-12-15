# backend/schemas.py
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ---------- USER SCHEMAS ----------
class UserBase(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    role: Optional[str] = None
    sport: Optional[str] = None
    experience: Optional[str] = None
    specialization: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


# 🔑 Full profile schema (Corrected emoji: originally 'ðŸ”‘')
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

    class Config:
        from_attributes = True  # Updated from orm_mode


class AuthResponse(BaseModel):
    token: str
    user: UserProfile


# ---------- SIMPLIFIED USER FOR POSTS/MESSAGES ----------
class PostUser(BaseModel):
    id: int
    name: str
    profile_photo: Optional[str]
    sport: Optional[str]
    location: Optional[str]

    class Config:
        from_attributes = True


# ---------- POSTS ----------
class PostBase(BaseModel):
    text: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None


class PostCreate(PostBase):
    pass


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

    class Config:
        from_attributes = True


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

    class Config:
        from_attributes = True


# ---------- MESSAGES ----------
class MessageBase(BaseModel):
    text: str
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None


class MessageCreate(MessageBase):
    pass


class MessageUpdate(BaseModel):
    text: Optional[str] = None


class MessageResponse(BaseModel):
    id: int
    sender_id: int
    sender: PostUser
    text: str
    attachment_url: Optional[str]
    attachment_type: Optional[str]
    is_read: bool
    created_at: datetime
    edited_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class ConversationBase(BaseModel):
    pass


class ConversationCreate(BaseModel):
    recipient_id: int


class ConversationResponse(BaseModel):
    id: int
    other_user: PostUser
    last_message_at: Optional[datetime]
    last_message_preview: Optional[str]
    unread_count: int = 0
    is_online: bool = False
    
    class Config:
        from_attributes = True


class ConversationDetailResponse(ConversationResponse):
    messages: List[MessageResponse] = []
    
    class Config:
        from_attributes = True


# ---------- STATS, CONNECTIONS, ETC ----------
class UserStats(BaseModel):
    name: str
    profilePhoto: Optional[str]
    nationalRank: Optional[int]
    aiScore: Optional[float]
    weeklyProgress: float

    class Config:
        from_attributes = True


class TrendingAthlete(BaseModel):
    id: int
    name: str
    profile_photo: Optional[str]
    sport: Optional[str]
    highlight_stat: str
    badge: Optional[str]

    class Config:
        from_attributes = True


class AnnouncementResponse(BaseModel):
    id: int
    title: str
    description: str
    icon: str
    link: Optional[str]

    class Config:
        from_attributes = True


class ConnectionSuggestion(BaseModel):
    id: int
    name: str
    profile_photo: Optional[str]
    sport: Optional[str]
    location: Optional[str]
    is_online: bool

    class Config:
        from_attributes = True


class PerformanceDataResponse(BaseModel):
    metric_type: str
    value: float
    unit: str
    recorded_at: datetime

    class Config:
        from_attributes = True
