import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://100.64.0.60:8000';

interface Image {
  id: number;
  url: string;
  label: string;
}

const GalleryPage: React.FC = () => {
  const [images, setImages] = useState<Image[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [labels, setLabels] = useState<string[]>(['None']);
  const location = useLocation();

  useEffect(() => {
    fetchImages();
    if (location.state && (location.state as any).labels) {
      setLabels((location.state as any).labels);
    }
  }, []);

  const fetchImages = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/images`);
      setImages(response.data.images.map((img: any) => ({ ...img, label: 'None' })));
    } catch (error) {
      console.error('Error fetching images:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLabelChange = (imageId: number, newLabel: string) => {
    setImages(prevImages =>
      prevImages.map(img =>
        img.id === imageId ? { ...img, label: newLabel } : img
      )
    );
  };

  const handleDownload = async () => {
    try {
      const imagesToDownload = images.map(img => ({
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

  if (isLoading) {
    return <div>Loading images...</div>;
  }

  return (
    <div className="gallery-page">
      <h1>Image Gallery</h1>
      <div className="image-grid">
        {images.map((image) => (
          <div key={image.id} className="image-container">
            <img src={`${API_URL}${image.url}`} alt={`Image ${image.id}`} />
            <select
              value={image.label}
              onChange={(e) => handleLabelChange(image.id, e.target.value)}
            >
              {labels.map((label, index) => (
                <option key={index} value={label}>{label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {images.length > 0 && (
        <button onClick={handleDownload}>Download Labeled Images</button>
      )}
    </div>
  );
};

export default GalleryPage;