import React, { useState, useEffect } from 'react';
import axios, { AxiosError } from 'axios';
import { logger } from '../utils/logger';
import Spinner from './Spinner';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://100.64.0.60:8000';
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

interface LabeledImage {
  url: string;
  label: string;
}

const ImageUploader: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [extractedImages, setExtractedImages] = useState<LabeledImage[]>([]);
  const [totalImages, setTotalImages] = useState(0);
  const [page, setPage] = useState(1);
  const [progress, setProgress] = useState(0);
  const [labels, setLabels] = useState<string[]>(['None']);
  const [newLabel, setNewLabel] = useState('');

  const imagesPerPage = 20;

  useEffect(() => {
    clearImages();
    return () => {
      clearImages();
    };
  }, []);

  useEffect(() => {
    console.log('useEffect triggered, page:', page);
    if (page > 1) {
      fetchImages(false);
    }
  }, [page]);

  const clearImages = async () => {
    try {
      await axios.post(`${API_URL}/api/clear-images`);
      setExtractedImages([]);
      setTotalImages(0);
      setPage(1);
      setLabels(['None']);
    } catch (error) {
      console.error('Error clearing images:', error);
    }
  };

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
      const newImages = response.data.images.map((img: string) => ({ url: `${API_URL}${img}`, label: 'None' }));
      console.log('New images:', newImages);
      setExtractedImages(newImages);
      setIsLoading(false);
    } catch (error) {
      console.error('Error uploading zip file:', error);
      toast.error('Failed to upload zip file. Please try again.');
    } finally {
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
      const newImages = response.data.images.map(img => ({ url: `${API_URL}${img.url}`, label: 'None' }));
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
    setPage(prevPage => prevPage + 1);
  };

  const handleAddLabel = () => {
    if (newLabel && !labels.includes(newLabel)) {
      setLabels([...labels, newLabel]);
      setNewLabel('');
    }
  };

  const handleLabelChange = (imageUrl: string, newLabel: string) => {
    setExtractedImages(prevImages =>
      prevImages.map(img =>
        img.url === imageUrl ? { ...img, label: newLabel } : img
      )
    );
  };

  const handleDownload = async () => {
    console.log('handleDownload called');
    try {
      const imagesToDownload = extractedImages.map(img => ({
        filename: img.url.split('/').pop() || '',
        label: img.label
      }));
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
      link.setAttribute('download', 'labeled_images.zip');
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
        if (axiosError.response) {
          console.error('Response data:', await axiosError.response.data.text());
        }
        alert(`Error downloading images: ${axiosError.message}\nResponse: ${JSON.stringify(axiosError.response?.data)}`);
      } else {
        alert(`Error downloading images: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  console.log('Rendering ImageUploader, extractedImages:', extractedImages);

  return (
    <div className="image-uploader">
      <ToastContainer />
      <div className="upload-section">
        <h2>Upload Zip File</h2>
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
      </div>

      <div className="label-section">
        <h2>Add Labels</h2>
        <div className="label-input">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Enter new label"
          />
          <button onClick={handleAddLabel}>Add Label</button>
        </div>
        <div className="label-list">
          <h3>Current Labels:</h3>
          <ul>
            {labels.map((label, index) => (
              <li key={index}>{label}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="image-gallery">
        <h2>Image Gallery</h2>
        <div className="image-grid">
          {extractedImages.map((image, index) => (
            <div key={index} className="image-container">
              <img src={image.url} alt={`Extracted ${index + 1}`} loading="lazy" />
              <select
                value={image.label}
                onChange={(e) => handleLabelChange(image.url, e.target.value)}
              >
                {labels.map((label, i) => (
                  <option key={i} value={label}>{label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        {extractedImages.length < totalImages && (
          <button onClick={handleLoadMore}>Load More</button>
        )}
      </div>

      {extractedImages.length > 0 && (
        <div className="download-section">
          <button onClick={handleDownload}>Download Labeled Images</button>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;