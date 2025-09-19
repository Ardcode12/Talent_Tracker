# backend/models.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Float, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


# Association tables
post_likes = Table(
    'post_likes',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('post_id', Integer, ForeignKey('posts.id')),
    Column('created_at', DateTime(timezone=True), server_default=func.now())
)

connections = Table(
    'connections',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('connected_user_id', Integer, ForeignKey('users.id')),
    Column('status', String(50), default='pending'),  # pending, accepted, rejected
    Column('created_at', DateTime(timezone=True), server_default=func.now())
)


class User(Base):
    __tablename__ = "users"
    
    # Basic info
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True)
    password = Column(String(255))
    name = Column(String(255), index=True)
    phone = Column(String(50), nullable=True)
    role = Column(String(100), nullable=True)

    # Profile fields
    profile_photo = Column(String(500), nullable=True)
    profile_image = Column(String(500), nullable=True)
    sport = Column(String(100), nullable=True)
    specialization = Column(String(255), nullable=True)
    experience = Column(Integer, nullable=True)
    location = Column(String(255), nullable=True)
    age = Column(Integer, nullable=True)
    bio = Column(Text, nullable=True)
    achievements = Column(Text, nullable=True)
    height = Column(String(50), nullable=True)
    weight = Column(String(50), nullable=True)
    skills = Column(Text, nullable=True)  # store as JSON string

    # Stats
    national_rank = Column(Integer, nullable=True)
    ai_score = Column(Float, nullable=True)
    weekly_progress = Column(Float, default=0.0)

    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_online = Column(Boolean, default=False)
    last_seen = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    posts = relationship("Post", back_populates="user", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="user", cascade="all, delete-orphan")
    liked_posts = relationship("Post", secondary=post_likes, back_populates="liked_by")
    performance_data = relationship("PerformanceData", back_populates="user", cascade="all, delete-orphan")

    # ✅ Add assessments relationship
    assessments = relationship("Assessment", back_populates="user", cascade="all, delete-orphan")

    # Social connections
    connections_initiated = relationship(
        "User",
        secondary=connections,
        primaryjoin=(connections.c.user_id == id),
        secondaryjoin=(connections.c.connected_user_id == id),
        backref="connections_received"
    )


class Post(Base):
    __tablename__ = "posts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    # Content
    text = Column(Text)
    media_url = Column(String(500), nullable=True)
    media_type = Column(String(50), nullable=True)  # image, video

    # Stats
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    shares_count = Column(Integer, default=0)

    # AI Verification
    is_ai_verified = Column(Boolean, default=False)
    ai_verification_score = Column(Float, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    liked_by = relationship("User", secondary=post_likes, back_populates="liked_posts")


class Comment(Base):
    __tablename__ = "comments"
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    text = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    post = relationship("Post", back_populates="comments")
    user = relationship("User", back_populates="comments")


class Announcement(Base):
    __tablename__ = "announcements"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255))
    description = Column(Text)
    icon = Column(String(10), default="📢")
    link = Column(String(500), nullable=True)
    priority = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)


class Assessment(Base):
    __tablename__ = "assessments"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    test_type = Column(String(100))          # e.g. Vertical Jump, Squats
    video_url = Column(String(500), nullable=True)
    score = Column(Float, nullable=True)
    ai_score = Column(Float, nullable=True)
    ai_feedback = Column(Text, nullable=True)
    status = Column(String(50), default="pending")

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship back to User
    user = relationship("User", back_populates="assessments")


class PerformanceData(Base):
    __tablename__ = "performance_data"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    metric_type = Column(String(100))  # speed, strength, endurance, etc.
    value = Column(Float)
    unit = Column(String(50))  # seconds, kg, meters, etc.

    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="performance_data")
