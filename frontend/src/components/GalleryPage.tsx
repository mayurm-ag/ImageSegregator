import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

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

  useEffect(() => {
    if (location.state && (location.state as any).labels) {
      setLabels((location.state as any).labels);
    }
    fetchImages(currentPage);
  }, [currentPage]);

  const fetchImages = async (page: number) => {
    try {
      const response = await axios.get<{ images: ApiImage[], total: number }>(`${API_URL}/api/images`, {
        params: { page, limit: imagesPerPage }
      });
      const newImages: Image[] = response.data.images.map((img: ApiImage) => ({ ...img, label: 'None' }));
      setImages(prevImages => {
        const updatedImages = [...prevImages];
        newImages.forEach((newImg: Image) => {
          const existingIndex = updatedImages.findIndex(img => img.id === newImg.id);
          if (existingIndex !== -1) {
            updatedImages[existingIndex] = { ...newImg, label: updatedImages[existingIndex].label };
          } else {
            updatedImages.push(newImg);
          }
        });
        return updatedImages;
      });
      setTotalPages(Math.ceil(response.data.total / imagesPerPage));
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
      const allImages = await fetchAllImages();
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

  const fetchAllImages = async (): Promise<Image[]> => {
    let allImages: Image[] = [];
    let page = 1;
    let hasMoreImages = true;

    while (hasMoreImages) {
      const response = await axios.get(`${API_URL}/api/images`, {
        params: { page, limit: 1000 }
      });
      const newImages = response.data.images.map((img: any) => ({ ...img, label: 'None' }));
      allImages = [...allImages, ...newImages];
      hasMoreImages = newImages.length === 1000;
      page++;
    }

    return allImages.map(img => {
      const matchingImage = images.find(i => i.id === img.id);
      return matchingImage ? { ...img, label: matchingImage.label } : img;
    });
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleNavigateHome = () => {
    navigate('/');
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
          .map((image) => (
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
      <div className="pagination">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            onClick={() => handlePageChange(page)}
            disabled={page === currentPage}
          >
            {page}
          </button>
        ))}
      </div>
      {currentPage === totalPages && (
        <button onClick={handleDownload}>Download All Labeled Images</button>
      )}
    </div>
  );
};

export default GalleryPage;