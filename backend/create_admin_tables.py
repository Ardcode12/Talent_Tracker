# backend/create_admin_tables.py
"""
Run this script to create admin and event tables
python create_admin_tables.py
"""

from database import engine, Base
import models

def create_tables():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")

def create_default_admin():
    from database import SessionLocal
    from core.security import get_password_hash
    
    db = SessionLocal()
    try:
        # Check if admin exists
        existing = db.query(models.AdminUser).filter(
            models.AdminUser.email == "admin@talenttracker.com"
        ).first()
        
        if not existing:
            admin = models.AdminUser(
                email="admin@talenttracker.com",
                password=get_password_hash("admin123"),
                name="System Admin",
                role="super_admin"
            )
            db.add(admin)
            db.commit()
            print("Default admin created!")
            print("Email: admin@talenttracker.com")
            print("Password: admin123")
        else:
            print("Admin already exists")
    finally:
        db.close()

if __name__ == "__main__":
    create_tables()
    create_default_admin()