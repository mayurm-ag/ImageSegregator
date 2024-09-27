import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://192.168.10.144:8000';

interface LabeledImage {
  url: string;
  label: string;
}

const GalleryPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [extractedImages, setExtractedImages] = useState<LabeledImage[]>([]);
  const [labels, setLabels] = useState<string[]>(['None']);

  useEffect(() => {
    if (location.state && location.state.labels) {
      setLabels(location.state.labels);
      fetchImages();
    } else {
      navigate('/');
    }
  }, [location, navigate]);

  const fetchImages = async () => {
    try {
      const response = await axios.get<{ images: Array<{ id: number, url: string }>, total: number }>(`${API_URL}/api/images`);
      setExtractedImages(response.data.images.map(img => ({ url: img.url, label: 'None' })));
    } catch (error) {
      console.error('Error fetching images:', error);
      alert('Error fetching images. Please try again.');
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
    try {
      const imagesToDownload = extractedImages.map(img => ({
        filename: img.url.split('/').pop() || '',
        label: img.label
      }));

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
      alert('Error downloading images. Please try again.');
    }
  };

  return (
    <div className="gallery-page">
      <h1>Image Gallery</h1>
      <div className="image-grid">
        {extractedImages.map((image, index) => (
          <div key={index} className="image-container">
            <img src={`${API_URL}${image.url}`} alt={`Extracted ${index + 1}`} loading="lazy" />
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
      {extractedImages.length > 0 && (
        <button onClick={handleDownload}>Download Labeled Images</button>
      )}
    </div>
  );
};

export default GalleryPage;