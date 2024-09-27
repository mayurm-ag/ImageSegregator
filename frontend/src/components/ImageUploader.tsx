import React, { useState, useEffect } from 'react';
import axios, { AxiosError } from 'axios';
import { logger } from '../utils/logger';
import Spinner from './Spinner';

const API_URL = process.env.REACT_APP_API_URL || 'http://192.168.10.144:8000';
console.log('API_URL:', API_URL);

interface UploadResponse {
  images: string[];
  total: number;
}

interface ImageData {
  id: number;
  url: string;
}

interface ProgressEvent {
  loaded: number;
  total?: number;
}

const ImageUploader: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [extractedImages, setExtractedImages] = useState<string[]>([]);
  const [totalImages, setTotalImages] = useState(0);
  const [page, setPage] = useState(1);
  const [progress, setProgress] = useState(0);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());

  const imagesPerPage = 20;

  useEffect(() => {
    console.log('Component mounted or page refreshed');
    clearImages();
  }, []);

  const clearImages = async () => {
    try {
      await axios.post(`${API_URL}/api/clear-images`);
      setExtractedImages([]);
      setTotalImages(0);
      setPage(1);
      setSelectedImages(new Set());
    } catch (error) {
      console.error('Error clearing images:', error);
    }
  };

  useEffect(() => {
    console.log('useEffect triggered, page:', page);
    if (page > 1) {
      fetchImages(false);
    }
  }, [page]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      console.log('File selected:', event.target.files[0].name);
    }
  };

  const handleUpload = async () => {
    console.log('handleUpload called');
    console.log(`API_URL: ${API_URL}`);
    if (!selectedFile) {
      console.log('No file selected');
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setExtractedImages([]);
    setTotalImages(0);
    setPage(1);
    setSelectedImages(new Set());
    const formData = new FormData();
    formData.append('zipfile', selectedFile);

    try {
      console.log(`Sending POST request to ${API_URL}/api/upload-zip`);
      console.log('FormData:', formData);
      const response = await axios.post<UploadResponse>(`${API_URL}/api/upload-zip`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: ProgressEvent) => {
          const percentCompleted = Math.round(((progressEvent.loaded) * 100) / (progressEvent.total || 1));
          console.log('Upload progress:', percentCompleted);
          setProgress(percentCompleted);
        },
      });
      console.log('Upload response:', response.data);
      setTotalImages(response.data.total);
      const newImages = response.data.images.map((img: string) => `${API_URL}${img}`);
      console.log('New images:', newImages);
      setExtractedImages(newImages);
      setIsLoading(false);
    } catch (error) {
      console.error('Error uploading zip file:', error);
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        console.error('Axios error details:', {
          message: axiosError.message,
          response: axiosError.response,
          request: axiosError.request,
          config: axiosError.config
        });
        alert(`Error uploading zip file: ${axiosError.message}\nResponse: ${JSON.stringify(axiosError.response?.data)}`);
      } else {
        alert(`Error uploading zip file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      setIsLoading(false);
    }
  };

  const fetchImages = async (reset: boolean) => {
    console.log('fetchImages called, page:', page, 'reset:', reset);
    try {
      const response = await axios.get<{ images: ImageData[], total: number }>(`${API_URL}/api/images`, {
        params: { page: reset ? 1 : page, limit: imagesPerPage },
      });
      console.log('Fetched images response:', response.data);
      const newImages = response.data.images.map(img => `${API_URL}${img.url}`);
      console.log('New images:', newImages);
      setExtractedImages(prevImages => {
        if (reset) {
          return newImages;
        } else {
          const updatedImages = [...prevImages, ...newImages];
          console.log('Updated images:', updatedImages);
          return updatedImages;
        }
      });
      setTotalImages(response.data.total);
      if (reset) {
        setPage(1);
      }
    } catch (error) {
      console.error('Error fetching images:', error);
    }
  };

  const handleLoadMore = () => {
    console.log('handleLoadMore called');
    setPage(prevPage => {
      const newPage = prevPage + 1;
      console.log('New page:', newPage);
      return newPage;
    });
  };

  const handleCheckboxChange = (imageSrc: string) => {
    console.log('handleCheckboxChange called for:', imageSrc);
    setSelectedImages((prevSelected) => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(imageSrc)) {
        newSelected.delete(imageSrc);
      } else {
        newSelected.add(imageSrc);
      }
      console.log('Updated selected images:', Array.from(newSelected));
      return newSelected;
    });
  };

  const handleDownload = async () => {
    console.log('handleDownload called');
    console.log('Selected images:', Array.from(selectedImages));
    try {
      const imagesToDownload = Array.from(selectedImages).map(imageSrc => {
        const parts = imageSrc.split('/');
        return parts[parts.length - 1];
      });
      console.log('Images to download:', imagesToDownload);

      const response = await axios.post(
        `${API_URL}/api/download-images`,
        { images: imagesToDownload },
        { 
          responseType: 'blob',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/zip',
          },
        }
      );
      console.log('Download response received', response);

      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'selected_images.zip');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading images:', error);
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        console.error('Axios error details:', {
          message: axiosError.message,
          response: axiosError.response,
          request: axiosError.request,
          config: axiosError.config
        });
        alert(`Error downloading images: ${axiosError.message}\nResponse: ${JSON.stringify(axiosError.response?.data)}`);
      } else {
        alert(`Error downloading images: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  console.log('Rendering ImageUploader, extractedImages:', extractedImages);

  return (
    <div className="image-uploader">
      <input type="file" accept=".zip" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={!selectedFile || isLoading}>
        {isLoading ? 'Uploading...' : 'Upload Zip File'}
      </button>
      {isLoading && (
        <div className="progress-container">
          <Spinner />
          <progress value={progress} max="100" />
          <p>{progress}% Uploaded</p>
        </div>
      )}
      <div className="image-grid">
        {extractedImages.map((imageSrc, index) => (
          <div key={index} className="image-container">
            <img src={imageSrc} alt={`Extracted ${index + 1}`} loading="lazy" />
            <input
              type="checkbox"
              checked={selectedImages.has(imageSrc)}
              onChange={() => handleCheckboxChange(imageSrc)}
            />
          </div>
        ))}
      </div>
      {extractedImages.length < totalImages && (
        <button onClick={handleLoadMore}>Load More</button>
      )}
      {selectedImages.size > 0 && (
        <button onClick={handleDownload}>Download Selected Images</button>
      )}
    </div>
  );
};

export default ImageUploader;