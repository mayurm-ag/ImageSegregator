import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Spinner from './Spinner';
import 'react-toastify/dist/ReactToastify.css';
import { saveAs } from 'file-saver';
import './GalleryPage.css';

const API_URL = process.env.REACT_APP_API_URL || '';

interface Image {
  id: number;
  url: string;
}

const GalleryPage: React.FC = () => {
  const [images, setImages] = useState<Image[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const navigate = useNavigate();
  const imagesPerPage = 20;
  const [isDownloading, setIsDownloading] = useState(false);
  const [totalImages, setTotalImages] = useState(0);
  const [selectedImage, setSelectedImage] = useState<Image | null>(null);

  const fetchImages = useCallback(async (page: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get<{ images: Image[], total: number }>(`${API_URL}/api/images`, {
        params: { page, limit: imagesPerPage }
      });
      setImages(response.data.images.map(img => ({
        ...img,
        url: API_URL ? img.url.replace(/^http:\/\/[^/]+/, API_URL) : img.url
      })));
      setTotalImages(response.data.total);
      setTotalPages(Math.ceil(response.data.total / imagesPerPage));
    } catch (error) {
      console.error('Error fetching images:', error);
      setError('Failed to load images. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages(currentPage);
  }, [currentPage, fetchImages]);

  const handleImageSelect = (imageId: number) => {
    setSelectedImages(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(imageId)) {
        newSelected.delete(imageId);
      } else {
        newSelected.add(imageId);
      }
      return newSelected;
    });
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/download-selected-images`,
        { selectedIds: Array.from(selectedImages) },
        { responseType: 'blob' }
      );

      const blob = new Blob([response.data], { type: 'application/zip' });
      saveAs(blob, 'selected_images.zip');

      console.log('Selected images downloaded successfully!');
    } catch (error) {
      console.error('Error downloading images:', error);
      alert('An error occurred while downloading images. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleNavigateHome = () => {
    navigate('/');
  };

  const handleImageClick = (image: Image) => {
    setSelectedImage(image);
  };

  const closeModal = () => {
    setSelectedImage(null);
  };

  const renderPageNumbers = () => {
    const pageNumbers: JSX.Element[] = [];
    const totalPageNumbers = 7;
    const sidePageNumbers = 2;

    if (totalPages <= totalPageNumbers) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(
          <button
            key={i}
            onClick={() => handlePageChange(i)}
            disabled={i === currentPage}
          >
            {i}
          </button>
        );
      }
    } else {
      pageNumbers.push(
        <button
          key={1}
          onClick={() => handlePageChange(1)}
          disabled={1 === currentPage}
        >
          1
        </button>
      );

      let startPage = Math.max(2, currentPage - sidePageNumbers);
      let endPage = Math.min(totalPages - 1, currentPage + sidePageNumbers);

      if (startPage <= 3) {
        endPage = Math.min(totalPages - 1, totalPageNumbers - 2);
      }
      if (endPage >= totalPages - 2) {
        startPage = Math.max(2, totalPages - totalPageNumbers + 3);
      }

      if (startPage > 2) {
        pageNumbers.push(<span key="ellipsis1">...</span>);
      }

      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(
          <button
            key={i}
            onClick={() => handlePageChange(i)}
            disabled={i === currentPage}
          >
            {i}
          </button>
        );
      }

      if (endPage < totalPages - 1) {
        pageNumbers.push(<span key="ellipsis2">...</span>);
      }

      pageNumbers.push(
        <button
          key={totalPages}
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages}
        >
          {totalPages}
        </button>
      );
    }

    return pageNumbers;
  };

  return (
    <div className="gallery-page">
      <h1>Image Gallery</h1>
      <button onClick={handleNavigateHome}>Back to Home</button>
      {isLoading ? (
        <div className="loading-container">
          <Spinner />
          <p>Loading images... Please wait.</p>
        </div>
      ) : error ? (
        <div className="error-container">
          <p>{error}</p>
          <button onClick={() => fetchImages(currentPage)}>Try Again</button>
        </div>
      ) : (
        <>
          <div className="image-grid">
            {images.map((image: Image) => (
              <div key={image.id} className="image-container">
                <img 
                  src={image.url} 
                  alt={`Image ${image.id}`} 
                  onClick={() => handleImageClick(image)}
                  className="thumbnail"
                />
                <input
                  type="checkbox"
                  checked={selectedImages.has(image.id)}
                  onChange={() => handleImageSelect(image.id)}
                />
              </div>
            ))}
          </div>
          {selectedImage && (
            <div className="modal" onClick={closeModal}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <img 
                  src={selectedImage.url} 
                  alt={`Full size ${selectedImage.id}`}
                  className="full-size-image"
                />
                <button onClick={closeModal}>Close</button>
              </div>
            </div>
          )}
          <div className="pagination">
            <button onClick={() => handlePageChange(1)} disabled={currentPage === 1}>First</button>
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>Prev</button>
            {renderPageNumbers()}
            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>Next</button>
            <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}>Last</button>
          </div>
          <p>Total Images: {totalImages}</p>
          <button onClick={handleDownload} disabled={isDownloading || selectedImages.size === 0}>
            {isDownloading ? <Spinner /> : `Download Selected Images (${selectedImages.size})`}
          </button>
        </>
      )}
    </div>
  );
};

export default GalleryPage;