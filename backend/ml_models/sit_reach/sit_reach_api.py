from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
import shutil
import uuid
from pathlib import Path
from datetime import datetime
import json
import logging
from typing import Optional, Dict
import sys
sys.path.append(str(Path(__file__).parent))

from sit_reach_analyzer import SitReachAnalyzer
# from database import get_db, Assessment, User
from sqlalchemy.orm import Session

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter(prefix="/api/sit-reach", tags=["sit-reach"])

# Initialize analyzer
analyzer = SitReachAnalyzer()

# Paths
UPLOAD_DIR = Path(__file__).parent / "uploads"
RESULTS_DIR = Path(__file__).parent / "results"
UPLOAD_DIR.mkdir(exist_ok=True)
RESULTS_DIR.mkdir(exist_ok=True)

@router.post("/analyze")
async def analyze_sit_reach(
    file: UploadFile = File(...),
    user_id: int = 1,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db)
):
    """Analyze sit and reach exercise from uploaded image"""
    
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Save uploaded file
    file_id = str(uuid.uuid4())
    file_extension = Path(file.filename).suffix
    file_path = UPLOAD_DIR / f"{file_id}{file_extension}"
    
    try:
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Analyze image
        result = analyzer.predict(str(file_path))
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error', 'Analysis failed'))
        
        # Save to database
        assessment = Assessment(
            user_id=user_id,
            exercise_type='sit_reach',
            score=result['scores']['overall'],
            form_score=result['scores']['form'],
            flexibility_score=result['scores']['flexibility'],
            reach_distance_cm=result['scores']['reach_distance_cm'],
            feedback=json.dumps(result['feedback']),
            video_path=str(file_path),
            thumbnail_path=result.get('visualization', ''),
            created_at=datetime.utcnow()
        )
        
        db.add(assessment)
        db.commit()
        db.refresh(assessment)
        
        # Schedule cleanup in background
        background_tasks.add_task(cleanup_old_files)
        
        # Prepare response
        response = {
            'success': True,
            'assessment_id': assessment.id,
            'scores': result['scores'],
            'feedback': result['feedback'],
            'prediction': result['prediction'],
            'visualization_url': f"/api/sit-reach/visualization/{Path(result.get('visualization', '')).name}"
        }
        
        return JSONResponse(content=response)
        
    except Exception as e:
        logger.error(f"Error analyzing sit reach: {e}")
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/visualization/{filename}")
async def get_visualization(filename: str):
    """Get visualization image"""
    file_path = RESULTS_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Visualization not found")
    
    return FileResponse(file_path)

@router.get("/assessment/{assessment_id}")
async def get_assessment(assessment_id: int, db: Session = Depends(get_db)):
    """Get assessment details"""
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    return {
        'id': assessment.id,
        'user_id': assessment.user_id,
        'scores': {
            'overall': assessment.score,
            'form': assessment.form_score,
            'flexibility': assessment.flexibility_score,
            'reach_distance_cm': assessment.reach_distance_cm
        },
        'feedback': json.loads(assessment.feedback),
        'created_at': assessment.created_at.isoformat()
    }

@router.post("/batch-analyze")
async def batch_analyze(
    files: List[UploadFile] = File(...),
    user_id: int = 1,
    db: Session = Depends(get_db)
):
    """Analyze multiple images"""
    results = []
    
    for file in files:
        try:
            # Process each file
            result = await analyze_sit_reach(file, user_id, BackgroundTasks(), db)
            results.append(result)
        except Exception as e:
            results.append({
                'filename': file.filename,
                'success': False,
                'error': str(e)
            })
    
    return {'results': results}

@router.get("/leaderboard")
async def get_leaderboard(db: Session = Depends(get_db), limit: int = 10):
    """Get top performers"""
    top_assessments = db.query(
        Assessment.user_id,
        func.max(Assessment.flexibility_score).label('best_flexibility'),
        func.max(Assessment.score).label('best_overall'),
        func.avg(Assessment.score).label('avg_score'),
        func.count(Assessment.id).label('total_attempts')
    ).filter(
        Assessment.exercise_type == 'sit_reach'
    ).group_by(
        Assessment.user_id
    ).order_by(
        func.max(Assessment.flexibility_score).desc()
    ).limit(limit).all()
    
    leaderboard = []
    for assessment in top_assessments:
        user = db.query(User).filter(User.id == assessment.user_id).first()
        leaderboard.append({
            'user_id': assessment.user_id,
            'username': user.username if user else 'Unknown',
            'best_flexibility': assessment.best_flexibility,
            'best_overall': assessment.best_overall,
            'avg_score': round(assessment.avg_score, 1),
            'total_attempts': assessment.total_attempts
        })
    
    return {'leaderboard': leaderboard}

def cleanup_old_files():
    """Remove old upload files"""
    import time
    cutoff_time = time.time() - (7 * 24 * 60 * 60)  # 7 days
    
    for file_path in UPLOAD_DIR.iterdir():
        if file_path.stat().st_mtime < cutoff_time:
            try:
                file_path.unlink()
                logger.info(f"Deleted old file: {file_path}")
            except Exception as e:
                logger.error(f"Error deleting file {file_path}: {e}")
