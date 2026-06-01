# backend/models.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Float, Table, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


# ============================================
# ASSOCIATION TABLES (Must be defined FIRST)
# ============================================

post_likes = Table(
    'post_likes',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE')),
    Column('post_id', Integer, ForeignKey('posts.id', ondelete='CASCADE')),
    Column('created_at', DateTime(timezone=True), server_default=func.now())
)

connections = Table(
    'connections',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE')),
    Column('connected_user_id', Integer, ForeignKey('users.id', ondelete='CASCADE')),
    Column('status', String(50), default='pending'),  # pending, accepted, rejected
    Column('created_at', DateTime(timezone=True), server_default=func.now())
)

# Comment likes table - MUST be defined before Comment class
comment_likes = Table(
    'comment_likes',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE')),
    Column('comment_id', Integer, ForeignKey('comments.id', ondelete='CASCADE')),
    Column('created_at', DateTime(timezone=True), server_default=func.now())
)

# Reply likes table - MUST be defined before CommentReply class
reply_likes = Table(
    'reply_likes',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE')),
    Column('reply_id', Integer, ForeignKey('comment_replies.id', ondelete='CASCADE')),
    Column('created_at', DateTime(timezone=True), server_default=func.now())
)


# ============================================
# USER MODEL
# ============================================

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
    assessments = relationship("Assessment", back_populates="user", cascade="all, delete-orphan")

    # Social connections
    connections_initiated = relationship(
        "User",
        secondary=connections,
        primaryjoin=(connections.c.user_id == id),
        secondaryjoin=(connections.c.connected_user_id == id),
        backref="connections_received"
    )


# ============================================
# CONVERSATION & MESSAGE MODELS
# ============================================

class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    user1_id = Column(Integer, ForeignKey('users.id'))
    user2_id = Column(Integer, ForeignKey('users.id'))
    
    last_message_at = Column(DateTime(timezone=True), nullable=True)
    last_message_preview = Column(String(255), nullable=True)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user1 = relationship("User", foreign_keys=[user1_id], backref="conversations_as_user1")
    user2 = relationship("User", foreign_keys=[user2_id], backref="conversations_as_user2")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    
    __table_args__ = (
        UniqueConstraint('user1_id', 'user2_id', name='unique_conversation'),
    )


class Message(Base):
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey('conversations.id'), index=True)
    sender_id = Column(Integer, ForeignKey('users.id'))
    
    text = Column(Text, nullable=False)
    attachment_url = Column(String(500), nullable=True)
    attachment_type = Column(String(50), nullable=True)
    
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    is_deleted = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    edited_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])


# ============================================
# POST MODEL
# ============================================

class Post(Base):
    __tablename__ = "posts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    text = Column(Text)
    media_url = Column(String(500), nullable=True)
    media_type = Column(String(50), nullable=True)

    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    shares_count = Column(Integer, default=0)

    is_ai_verified = Column(Boolean, default=False)
    ai_verification_score = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    liked_by = relationship("User", secondary=post_likes, back_populates="liked_posts")


# ============================================
# COMMENT MODEL (with likes and replies support)
# ============================================

class Comment(Base):
    __tablename__ = "comments"
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    text = Column(Text)
    
    # Likes count
    likes_count = Column(Integer, default=0)
    
    # Replies count for quick access
    replies_count = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    post = relationship("Post", back_populates="comments")
    user = relationship("User", back_populates="comments")
    replies = relationship(
        "CommentReply", 
        back_populates="comment", 
        cascade="all, delete-orphan",
        order_by="CommentReply.created_at"
    )
    liked_by = relationship(
        "User", 
        secondary=comment_likes, 
        backref="liked_comments"
    )


# ============================================
# COMMENT REPLY MODEL
# ============================================

class CommentReply(Base):
    __tablename__ = "comment_replies"
    
    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Reply content
    text = Column(Text, nullable=False)
    
    # Optional: mention another user in reply (@username)
    reply_to_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Stats
    likes_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    comment = relationship("Comment", back_populates="replies")
    user = relationship("User", foreign_keys=[user_id], backref="comment_replies")
    reply_to_user = relationship("User", foreign_keys=[reply_to_user_id])
    liked_by = relationship(
        "User", 
        secondary=reply_likes, 
        backref="liked_replies"
    )


# ============================================
# ANNOUNCEMENT MODEL
# ============================================

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


# ============================================
# ASSESSMENT MODEL
# ============================================

class Assessment(Base):
    __tablename__ = "assessments"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    test_type = Column(String(100))
    video_url = Column(String(500), nullable=True)
    score = Column(Float, nullable=True)
    ai_score = Column(Float, nullable=True)
    ai_feedback = Column(Text, nullable=True)
    status = Column(String(50), default="pending")

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    user = relationship("User", back_populates="assessments")


# ============================================
# PERFORMANCE DATA MODEL
# ============================================

class PerformanceData(Base):
    __tablename__ = "performance_data"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    metric_type = Column(String(100))
    value = Column(Float)
    unit = Column(String(50))

    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="performance_data")


# ============================================
# EVENT MODEL
# ============================================

class Event(Base):
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Event creator (coach)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Event details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(String(100), nullable=False)
    sport = Column(String(100), nullable=True)
    
    # Location
    location = Column(String(255), nullable=True)
    venue = Column(String(255), nullable=True)
    is_online = Column(Boolean, default=False)
    online_link = Column(String(500), nullable=True)
    
    # Dates
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=True)
    registration_deadline = Column(DateTime(timezone=True), nullable=True)
    
    # Capacity
    max_participants = Column(Integer, nullable=True)
    current_participants = Column(Integer, default=0)
    
    # Requirements
    min_age = Column(Integer, nullable=True)
    max_age = Column(Integer, nullable=True)
    min_ai_score = Column(Float, nullable=True)
    eligibility_criteria = Column(Text, nullable=True)
    
    # Media
    banner_image = Column(String(500), nullable=True)
    
    # Status & Approval
    status = Column(String(50), default="pending")
    approval_status = Column(String(50), default="pending")
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Visibility
    is_public = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    creator = relationship("User", foreign_keys=[created_by], backref="created_events")
    approver = relationship("User", foreign_keys=[approved_by], backref="approved_events")


# ============================================
# EVENT REGISTRATION MODEL
# ============================================

class EventRegistration(Base):
    __tablename__ = "event_registrations"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    status = Column(String(50), default="registered")
    registered_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    event = relationship("Event", backref="registrations")
    user = relationship("User", backref="event_registrations")
    
    __table_args__ = (
        UniqueConstraint('event_id', 'user_id', name='unique_event_registration'),
    )


# ============================================
# ADMIN USER MODEL
# ============================================

class AdminUser(Base):
    __tablename__ = "admin_users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(50), default="admin")
    
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())