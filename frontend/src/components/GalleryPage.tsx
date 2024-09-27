import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://192.168.10.144:8000';

interface LabeledImage {
  id: number;
  url: string;
  label: string;
}

const GalleryPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [allImages, setAllImages] = useState<LabeledImage[]>([]);
  const [displayedImages, setDisplayedImages] = useState<LabeledImage[]>([]);
  const [labels, setLabels] = useState<string[]>(['None']);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [totalImages, setTotalImages] = useState(0);
  const imagesPerPage = 20;

  useEffect(() => {
    if (location.state && location.state.labels) {
      setLabels(location.state.labels);
      fetchAllImages();
    } else {
      navigate('/');
    }
  }, [location, navigate]);

  useEffect(() => {
    updateDisplayedImages();
  }, [currentPage, allImages]);

  const fetchAllImages = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get<{ images: Array<{ id: number, url: string }>, total: number }>(`${API_URL}/api/images`, {
        params: { page: 1, limit: 1000 } // Fetch all images at once
      });
      const fetchedImages = response.data.images.map(img => ({ id: img.id, url: img.url, label: 'None' }));
      setAllImages(fetchedImages);
      setTotalImages(response.data.total);
      setTotalPages(Math.ceil(response.data.total / imagesPerPage));
    } catch (error) {
      console.error('Error fetching images:', error);
      alert('Error fetching images. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateDisplayedImages = () => {
    const startIndex = (currentPage - 1) * imagesPerPage;
    const endIndex = startIndex + imagesPerPage;
    setDisplayedImages(allImages.slice(startIndex, endIndex));
  };

  const handleLabelChange = (imageId: number, newLabel: string) => {
    setAllImages(prevImages =>
      prevImages.map(img =>
        img.id === imageId ? { ...img, label: newLabel } : img
      )
    );
  };

  const handleDownload = async () => {
    try {
      setIsLoading(true);
      
      const imagesToDownload = allImages.map(img => ({
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
      link.setAttribute('download', 'all_labeled_images.zip');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading images:', error);
      alert('Error downloading images. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderPagination = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(
        <button
          key={i}
          onClick={() => setCurrentPage(i)}
          className={currentPage === i ? 'active' : ''}
        >
          {i}
        </button>
      );
    }

    return (
      <div className="pagination">
        <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>First</button>
        <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>Previous</button>
        {startPage > 1 && <span>...</span>}
        {pageNumbers}
        {endPage < totalPages && <span>...</span>}
        <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>Next</button>
        <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>Last</button>
      </div>
    );
  };

  return (
    <div className="gallery-page">
      <header className="gallery-header">
        <h1>Image Gallery</h1>
      </header>
      {isLoading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          <div className="image-grid">
            {displayedImages.map((image) => (
              <div key={image.id} className="image-container">
                <img src={`${API_URL}${image.url}`} alt={`Extracted ${image.id}`} loading="lazy" />
                <select
                  value={image.label}
                  onChange={(e) => handleLabelChange(image.id, e.target.value)}
                >
                  {labels.map((label, i) => (
                    <option key={i} value={label}>{label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {renderPagination()}
        </>
      )}
      <div className="gallery-footer">
        <p>Page {currentPage} of {totalPages}</p>
        <p>Total Images: {totalImages}</p>
        <button className="download-all-button" onClick={handleDownload} disabled={isLoading}>
          {isLoading ? 'Preparing Download...' : 'Download All Labeled Images'}
        </button>
      </div>
    </div>
  );
};

export default GalleryPage;