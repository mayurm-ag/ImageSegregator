from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os
import uuid
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import time
from sqlalchemy.exc import OperationalError
import logging
from logging.handlers import RotatingFileHandler
import zipfile
import io
from starlette.responses import StreamingResponse
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles

# Create logs directory if it doesn't exist
os.makedirs('logs', exist_ok=True)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create a file handler
file_handler = RotatingFileHandler('logs/app.log', maxBytes=10240, backupCount=10)
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))

# Add the file handler to the logger
logger.addHandler(file_handler)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for now, you can restrict this later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database configuration
SQLALCHEMY_DATABASE_URL = "postgresql://user:password@db/image_gallery"

# Retry mechanism for database connection
max_retries = 5
retry_delay = 5

for attempt in range(max_retries):
    try:
        logger.info(f"Attempting to connect to database (attempt {attempt + 1})")
        engine = create_engine(SQLALCHEMY_DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        Base = declarative_base()
        
        class Image(Base):
            __tablename__ = "images"

            id = Column(Integer, primary_key=True, index=True)
            filename = Column(String, unique=True, index=True)
            url = Column(String)
            label = Column(String, default='None')
        
        Base.metadata.create_all(bind=engine)
        logger.info("Successfully connected to database and created tables")
        break
    except OperationalError as e:
        logger.error(f"Database connection attempt {attempt + 1} failed: {str(e)}")
        if attempt < max_retries - 1:
            logger.info(f"Retrying in {retry_delay} seconds...")
            time.sleep(retry_delay)
        else:
            logger.error("Failed to connect to the database after multiple attempts.")
            raise

# Add this near the top of the file, after creating the FastAPI app
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.post("/api/upload-zip")
async def upload_zip(background_tasks: BackgroundTasks, zipfile: UploadFile = File(...)):
    logger.info(f"Received zip file upload: {zipfile.filename}")
    try:
        # Clear all existing images
        db = SessionLocal()
        db.query(Image).delete()
        db.commit()
        db.close()
        
        # Clear uploads directory
        uploads_dir = "uploads"
        for filename in os.listdir(uploads_dir):
            file_path = os.path.join(uploads_dir, filename)
            try:
                if os.path.isfile(file_path):
                    os.unlink(file_path)
            except Exception as e:
                logger.error(f"Error deleting {file_path}: {str(e)}")
        
        logger.info("Cleared existing images from database and uploads directory")

        logger.info("Reading zip file contents")
        contents = await zipfile.read()
        logger.info(f"Zip file size: {len(contents)} bytes")
        
        background_tasks.add_task(process_zip_file, contents)
        
        return JSONResponse(content={"message": "Zip file upload started. Processing in background."})
    except Exception as e:
        logger.error(f"Error processing zip file: {str(e)}", exc_info=True)
        return JSONResponse(content={"error": str(e)}, status_code=500)

async def process_zip_file(contents: bytes):
    try:
        with zipfile.ZipFile(io.BytesIO(contents)) as zip_file:
            extracted_images = []
            for file_name in zip_file.namelist():
                logger.info(f"Processing file: {file_name}")
                # Skip __MACOSX directory and hidden files
                if file_name.startswith('__MACOSX') or file_name.startswith('.'):
                    logger.info(f"Skipping file: {file_name}")
                    continue
                if file_name.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                    image_data = zip_file.read(file_name)
                    unique_filename = f"{uuid.uuid4()}{os.path.splitext(file_name)[1]}"
                    file_path = f"uploads/{unique_filename}"
                    
                    logger.info(f"Saving file: {file_path}")
                    os.makedirs("uploads", exist_ok=True)
                    
                    with open(file_path, "wb") as f:
                        f.write(image_data)
                    
                    logger.info("Adding image to database")
                    db = SessionLocal()
                    db_image = Image(filename=unique_filename, url=f"/uploads/{unique_filename}", label='None')
                    db.add(db_image)
                    db.commit()
                    db.close()
                    
                    logger.info(f"Saved image: {file_path}")
                    extracted_images.append(f"/uploads/{unique_filename}")
            
            logger.info(f"Extracted and saved {len(extracted_images)} images from the zip file")
    except Exception as e:
        logger.error(f"Error processing zip file in background: {str(e)}", exc_info=True)

@app.get("/api/images")
async def get_images(page: int = 1, limit: int = 20):
    db = SessionLocal()
    offset = (page - 1) * limit
    images = db.query(Image).order_by(Image.id).offset(offset).limit(limit).all()
    total_images = db.query(Image).count()
    db.close()
    return {
        "images": [
            {
                "id": img.id,
                "url": f"{os.getenv('SERVER_URL', 'http://localhost:8000')}{img.url}",
                "label": img.label
            } for img in images
        ],
        "total": total_images
    }

# Add this new model for label updates
class LabelUpdate(BaseModel):
    image_id: int
    label: str

@app.post("/api/update-label")
async def update_label(label_update: LabelUpdate):
    db = SessionLocal()
    try:
        image = db.query(Image).filter(Image.id == label_update.image_id).first()
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")
        image.label = label_update.label
        db.commit()
        return {"message": "Label updated successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating label: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating label: {str(e)}")
    finally:
        db.close()

@app.get("/api/download-all-images")
async def download_all_images():
    db = SessionLocal()
    try:
        images = db.query(Image).all()
        
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for image in images:
                file_path = os.path.join("uploads", image.filename)
                if os.path.exists(file_path):
                    zip_file.write(file_path, arcname=f"{image.label}/{image.filename}")
                else:
                    logger.warning(f"File not found: {file_path}")

        buffer.seek(0)
        return StreamingResponse(
            io.BytesIO(buffer.getvalue()),
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=labeled_images.zip"}
        )
    except Exception as e:
        logger.error(f"Error creating zip file: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error creating zip file: {str(e)}")
    finally:
        db.close()

class SelectedImages(BaseModel):
    selectedIds: List[int]

@app.post("/api/download-selected-images")
async def download_selected_images(selected_images: SelectedImages):
    try:
        db = SessionLocal()
        images = db.query(Image).filter(Image.id.in_(selected_images.selectedIds)).all()
        
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for image in images:
                file_path = os.path.join("uploads", image.filename)
                if os.path.exists(file_path):
                    zip_file.write(file_path, arcname=image.filename)
                else:
                    logger.warning(f"File not found: {file_path}")

        buffer.seek(0)
        return StreamingResponse(
            io.BytesIO(buffer.getvalue()),
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=selected_images.zip"}
        )
    except Exception as e:
        logger.error(f"Error creating zip file for selected images: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error creating zip file: {str(e)}")
    finally:
        db.close()

# ... (keep other existing routes and functions)

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting the application")
    uvicorn.run(app, host="0.0.0.0", port=8000)