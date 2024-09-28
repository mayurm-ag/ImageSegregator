import React, { useState, useEffect } from 'react';
import ImageGallery from '../components/ImageGallery';
import Spinner from '../components/Spinner';

export default function Home() {
  const [images, setImages] = useState([]);
  const [labels, setLabels] = useState({});
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    // Fetch images and labels from the server
    // This is just a placeholder, replace with your actual data fetching logic
    const fetchData = async () => {
      // Simulating API call
      const response = await fetch('/api/images');
      const data = await response.json();
      setImages(data.images);
      setLabels(data.labels);
    };

    fetchData();
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      fetch('/api/cleanup', { method: 'POST' });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleLabelChange = (imageId, label) => {
    setLabels(prevLabels => ({
      ...prevLabels,
      [imageId]: label
    }));
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // Implement your download logic here
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulating download
    } catch (error) {
      console.error('Error downloading images:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="container">
      <h1>Image Labeling App</h1>
      <ImageGallery 
        images={images} 
        labels={labels} 
        onLabelChange={handleLabelChange} 
      />
      <button onClick={handleDownload} disabled={isDownloading}>
        {isDownloading ? <Spinner /> : 'Download Images'}
      </button>
    </div>
  );
}