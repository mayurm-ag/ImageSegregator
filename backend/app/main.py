from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, FileResponse
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
        if os.path.isfile(file_path):
            os.unlink(file_path)
    logger.info("Cleared uploads directory")

# Call this function right after the app initialization
app = FastAPI()
clear_uploads_directory()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://192.168.10.144:3000"],  # Make sure this matches your frontend URL
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
            db_image = Image(filename=filename, url=f"http://192.168.10.144:8000/uploads/{filename}")
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
async def upload_zip(zipfile: UploadFile = File(...)):
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
                    
                    extracted_images.append(f"/uploads/{unique_filename}")
            
            logger.info(f"Extracted and saved {len(extracted_images)} images from the zip file")
            
            # Double-check the number of images in the database
            db = SessionLocal()
            total_images = db.query(Image).count()
            db.close()
            
            logger.info(f"Total images in database after upload: {total_images}")
            
            return JSONResponse(content={"images": extracted_images, "total": total_images})
    except Exception as e:
        logger.error(f"Error processing zip file: {str(e)}", exc_info=True)
        return JSONResponse(content={"error": str(e)}, status_code=500)

from pydantic import BaseModel
from typing import List

class ImageInfo(BaseModel):
    filename: str
    label: str

class DownloadRequest(BaseModel):
    images: List[ImageInfo]

@app.post("/api/download-images")
async def download_images(request: DownloadRequest):
    logger.info(f"Received request to download {len(request.images)} images")
    current_dir = os.getcwd()
    logger.info(f"Current working directory: {current_dir}")
    
    zip_filename = f"labeled_images_{uuid.uuid4()}.zip"
    zip_filepath = os.path.join(current_dir, zip_filename)
    temp_dir = os.path.join(current_dir, f"temp_download_{uuid.uuid4()}")
    
    try:
        # Create a temporary directory to store the images
        os.makedirs(temp_dir, exist_ok=True)
        logger.info(f"Created temporary directory: {temp_dir}")

        # Copy selected images to the temporary directory
        for image in request.images:
            label_dir = os.path.join(temp_dir, image.label)
            os.makedirs(label_dir, exist_ok=True)
            
            full_path = os.path.join(current_dir, "uploads", image.filename)
            dest_path = os.path.join(label_dir, image.filename)
            
            logger.info(f"Attempting to copy file: {full_path} to {dest_path}")
            if os.path.exists(full_path):
                shutil.copy(full_path, dest_path)
                logger.info(f"Copied file: {full_path} to {dest_path}")
            else:
                logger.warning(f"Image not found: {full_path}")

        # Create a zip file containing the labeled images
        logger.info(f"Creating zip file: {zip_filepath}")
        shutil.make_archive(zip_filepath[:-4], 'zip', temp_dir)
        logger.info(f"Zip file created: {zip_filepath}")

        # Check if the zip file was created successfully
        if not os.path.exists(zip_filepath):
            raise FileNotFoundError(f"Failed to create zip file: {zip_filepath}")

        # Get the file size
        file_size = os.path.getsize(zip_filepath)
        logger.info(f"Zip file size: {file_size} bytes")

        # Return the zip file
        logger.info(f"Returning zip file: {zip_filepath}")
        return FileResponse(
            zip_filepath,
            media_type="application/zip",
            filename=zip_filename,
            headers={"Content-Disposition": f"attachment; filename={zip_filename}"}
        )
    except Exception as e:
        logger.error(f"Error creating zip file: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error creating zip file: {str(e)}")
    finally:
        # Clean up the temporary directory
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
            logger.info(f"Temporary directory removed: {temp_dir}")
        
        # Schedule zip file removal
        cleanup_task = asyncio.create_task(delayed_cleanup(zip_filepath))
        logger.info(f"Scheduled cleanup task for zip file: {zip_filepath}")

async def delayed_cleanup(filepath: str, delay: int = 60):
    """
    Asynchronously delete a file after a specified delay.
    """
    await asyncio.sleep(delay)
    try:
        os.remove(filepath)
        logger.info(f"Zip file removed after delay: {filepath}")
    except Exception as e:
        logger.error(f"Error removing zip file after delay: {str(e)}", exc_info=True)

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