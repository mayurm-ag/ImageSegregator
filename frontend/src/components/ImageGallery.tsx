import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { logger } from '../utils/logger';

interface Image {
  id: number;
  url: string;
}

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const ImageGallery: React.FC = () => {
  const [images, setImages] = useState<Image[]>([]);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        logger.log(`Fetching images from ${API_URL}/api/images`);
        const response = await axios.get<Image[]>(`${API_URL}/api/images`);
        logger.log('Fetched images:', response.data);
        setImages(response.data);
      } catch (error) {
        logger.error('Error fetching images:', error);
        if (axios.isAxiosError(error)) {
          logger.error('Axios error details:', {
            message: error.message,
            response: error.response,
            request: error.request,
            config: error.config
          });
        }
      }
    };

    fetchImages();
  }, []);

  return (
    <div className="image-gallery">
      {images.map((image) => (
        <img key={image.id} src={image.url} alt={`Gallery item ${image.id}`} />
      ))}
    </div>
  );
};

export default ImageGallery;