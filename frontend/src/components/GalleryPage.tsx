import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Spinner from './Spinner';
import 'react-toastify/dist/ReactToastify.css';
import { saveAs } from 'file-saver';

const API_URL = process.env.REACT_APP_API_URL || 'http://100.64.0.60:8000';

interface Image {
  id: number;
  url: string;
  label: string;
}

interface ApiImage {
  id: number;
  url: string;
}

const GalleryPage: React.FC = () => {
  const [images, setImages] = useState<Image[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [labels, setLabels] = useState<string[]>(['None']);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const location = useLocation();
  const navigate = useNavigate();
  const imagesPerPage = 20;
  const [isDownloading, setIsDownloading] = useState(false);
  const [totalImages, setTotalImages] = useState(0);

  useEffect(() => {
    if (location.state && (location.state as any).labels) {
      setLabels((location.state as any).labels);
    }
    fetchImages(currentPage);
  }, [currentPage, location.state]);

  const fetchImages = async (page: number) => {
    setIsLoading(true);
    try {
      const response = await axios.get<{ images: Image[], total: number }>(`${API_URL}/api/images`, {
        params: { page, limit: imagesPerPage }
      });
      setImages(prevImages => {
        const newImages = response.data.images;
        const updatedImages = [...prevImages];
        newImages.forEach(newImage => {
          const index = updatedImages.findIndex(img => img.id === newImage.id);
          if (index !== -1) {
            updatedImages[index] = { ...updatedImages[index], ...newImage };
          } else {
            updatedImages.push(newImage);
          }
        });
        return updatedImages.sort((a, b) => a.id - b.id);
      });
      setTotalImages(response.data.total);
      setTotalPages(Math.ceil(response.data.total / imagesPerPage));
    } catch (error) {
      console.error('Error fetching images:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLabelChange = async (imageId: number, newLabel: string) => {
    try {
      await axios.post(`${API_URL}/api/update-label`, { image_id: imageId, label: newLabel });
      setImages(prevImages =>
        prevImages.map(img =>
          img.id === imageId ? { ...img, label: newLabel } : img
        )
      );
    } catch (error) {
      console.error('Error updating label:', error);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await axios.get(`${API_URL}/api/download-all-images`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/zip' });
      saveAs(blob, 'labeled_images.zip');

      console.log('Images downloaded successfully!');
    } catch (error) {
      console.error('Error downloading images:', error);
      console.error('An error occurred while downloading images. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const fetchAllImages = async (): Promise<Image[]> => {
    let allImages: Image[] = [];
    let page = 1;
    let hasMoreImages = true;

    while (hasMoreImages) {
      const response = await axios.get<{ images: ApiImage[], total: number }>(`${API_URL}/api/images`, {
        params: { page, limit: 1000 }
      });
      const newImages = response.data.images.map((img: ApiImage) => ({ ...img, label: 'None' }));
      allImages = [...allImages, ...newImages];
      hasMoreImages = newImages.length === 1000;
      page++;
    }

    return allImages.map(img => {
      const matchingImage = images.find((i: Image) => i.id === img.id);
      return matchingImage ? { ...img, label: matchingImage.label } : img;
    });
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleNavigateHome = () => {
    navigate('/');
  };

  const renderPageNumbers = () => {
    const pageNumbers: JSX.Element[] = [];
    const totalPageNumbers = 7; // Total number of page buttons to show
    const sidePageNumbers = 2; // Number of pages to show on each side of the current page

    if (totalPages <= totalPageNumbers) {
      // If total pages are less than or equal to totalPageNumbers, show all pages
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
      // Always show first page
      pageNumbers.push(
        <button
          key={1}
          onClick={() => handlePageChange(1)}
          disabled={1 === currentPage}
        >
          1
        </button>
      );

      // Calculate start and end page numbers
      let startPage = Math.max(2, currentPage - sidePageNumbers);
      let endPage = Math.min(totalPages - 1, currentPage + sidePageNumbers);

      // Adjust in case we're too close to the start or end
      if (startPage <= 3) {
        endPage = Math.min(totalPages - 1, totalPageNumbers - 2);
      }
      if (endPage >= totalPages - 2) {
        startPage = Math.max(2, totalPages - totalPageNumbers + 3);
      }

      // Add ellipsis if needed
      if (startPage > 2) {
        pageNumbers.push(<span key="ellipsis1">...</span>);
      }

      // Add page numbers
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

      // Add ellipsis if needed
      if (endPage < totalPages - 1) {
        pageNumbers.push(<span key="ellipsis2">...</span>);
      }

      // Always show last page
      pageNumbers.push(
        <button
          key={totalPages}
          onClick={() => handlePageChange(totalPages)}
          disabled={totalPages === currentPage}
        >
          {totalPages}
        </button>
      );
    }

    return pageNumbers;
  };

  if (isLoading) {
    return <div>Loading images...</div>;
  }

  return (
    <div className="gallery-page">
      <h1>Image Gallery</h1>
      <button onClick={handleNavigateHome}>Back to Home</button>
      <div className="image-grid">
        {images
          .slice((currentPage - 1) * imagesPerPage, currentPage * imagesPerPage)
          .map((image: Image) => (
            <div key={image.id} className="image-container">
              <img src={image.url} alt={`Image ${image.id}`} />
              <select
                value={image.label}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleLabelChange(image.id, e.target.value)}
              >
                {labels.map((label: string, index: number) => (
                  <option key={index} value={label}>{label}</option>
                ))}
              </select>
            </div>
          ))}
      </div>
      <div className="pagination">
        <button onClick={() => handlePageChange(1)} disabled={currentPage === 1}>First</button>
        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>Prev</button>
        {renderPageNumbers()}
        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>Next</button>
        <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}>Last</button>
      </div>
      <p>Total Images: {totalImages}</p>
      <button onClick={handleDownload} disabled={isDownloading}>
        {isDownloading ? <Spinner /> : 'Download All Labeled Images'}
      </button>
    </div>
  );
};

export default GalleryPage;