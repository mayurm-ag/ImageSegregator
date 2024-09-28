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
import base64
from io import BytesIO
import shutil
from zipfile import ZipFile
from pydantic import BaseModel
import asyncio

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

# Add this function at the beginning of the file, after the imports
def clear_uploads_directory():
    uploads_dir = "uploads"
    for filename in os.listdir(uploads_dir):
        file_path = os.path.join(uploads_dir, filename)
        try:
            if os.path.isfile(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
        except Exception as e:
            logger.error(f"Error deleting {file_path}: {str(e)}")
    logger.info("Cleared uploads directory")

# Call this function right after the app initialization
app = FastAPI()
clear_uploads_directory()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://100.64.0.60:3000"],  # Make sure this matches your frontend URL
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

@app.post("/api/upload")
async def upload_images(images: List[UploadFile] = File(...)):
    logger.info(f"Received upload request for {len(images)} images")
    try:
        uploaded_filenames = []
        for image in images:
            logger.info(f"Processing image: {image.filename}")
            file_extension = os.path.splitext(image.filename)[1]
            filename = f"{uuid.uuid4()}{file_extension}"
            file_path = f"uploads/{filename}"
            
            # Ensure the uploads directory exists
            os.makedirs("uploads", exist_ok=True)
            
            logger.info(f"Saving file: {filename}")
            with open(file_path, "wb") as buffer:
                content = await image.read()
                buffer.write(content)
            
            logger.info(f"File saved: {filename}")
            
            db = SessionLocal()
            db_image = Image(filename=filename, url=f"http://100.64.0.60:8000/uploads/{filename}")
            db.add(db_image)
            db.commit()
            db.close()
            
            logger.info(f"Database entry created for: {filename}")
            
            uploaded_filenames.append(filename)
        
        logger.info(f"Successfully uploaded {len(uploaded_filenames)} images")
        return {"filenames": uploaded_filenames}
    except Exception as e:
        logger.error(f"Error uploading images: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error uploading images: {str(e)}")

@app.get("/api/images")
async def get_images(page: int = 1, limit: int = 20):
    logger.info(f"Received request to get images (page {page}, limit {limit})")
    db = SessionLocal()
    offset = (page - 1) * limit
    images = db.query(Image).offset(offset).limit(limit).all()
    total_images = db.query(Image).count()
    db.close()
    image_list = [{"id": image.id, "url": f"/uploads/{image.filename}"} for image in images]
    logger.info(f"Returning {len(image_list)} images for this page")
    logger.info(f"Total images in database: {total_images}")
    return {"images": image_list, "total": total_images}

@app.post("/api/upload-zip")
async def upload_zip(background_tasks: BackgroundTasks, zipfile: UploadFile = File(...)):
    logger.info(f"Received zip file upload: {zipfile.filename}")
    try:
        # Clear all existing images
        db = SessionLocal()
        db.query(Image).delete()
        db.commit()
        db.close()
        
        clear_uploads_directory()
        
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
        with ZipFile(BytesIO(contents)) as zip_file:
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
                    db_image = Image(filename=unique_filename, url=f"/uploads/{unique_filename}")
                    db.add(db_image)
                    db.commit()
                    db.close()
                    
                    logger.info(f"Saved image: {file_path}")
                    extracted_images.append(f"/uploads/{unique_filename}")
            
            logger.info(f"Extracted and saved {len(extracted_images)} images from the zip file")
            # Remove the following line to stop logging the entire list of extracted images
            # logger.info(f"Extracted images: {extracted_images}")
    except Exception as e:
        logger.error(f"Error processing zip file in background: {str(e)}", exc_info=True)

from pydantic import BaseModel
from typing import List

class ImageInfo(BaseModel):
    filename: str
    label: str

class DownloadRequest(BaseModel):
    images: List[ImageInfo]

@app.post("/api/download-images")
async def download_images(request: DownloadRequest):
    def generate_zip():
        with io.BytesIO() as buffer:
            with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for image in request.images:
                    # Add each image to the zip file
                    # Yield chunks of the buffer periodically
                    yield buffer.getvalue()
                    buffer.seek(0)
                    buffer.truncate()
    
    return StreamingResponse(generate_zip(), media_type="application/zip", headers={"Content-Disposition": f"attachment; filename=labeled_images.zip"})

@app.post("/api/clear-images")
async def clear_images():
    logger.info("Received request to clear all images")
    try:
        # Clear images from the database
        db = SessionLocal()
        db.query(Image).delete()
        db.commit()
        db.close()
        
        # Clear images from the uploads directory
        clear_uploads_directory()
        
        logger.info("Cleared all images from database and uploads directory")
        return JSONResponse(content={"message": "All images cleared successfully"})
    except Exception as e:
        logger.error(f"Error clearing images: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error clearing images: {str(e)}")

from fastapi.staticfiles import StaticFiles

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting the application")
    uvicorn.run(app, host="0.0.0.0", port=8000)