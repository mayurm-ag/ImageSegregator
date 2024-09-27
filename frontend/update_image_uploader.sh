#!/bin/bash

cat > src/components/ImageUploader.tsx << EOL
import axios, { AxiosResponse } from 'axios';
import React, { useState, ChangeEvent } from 'react';

interface UploadResponse {
  images: string[];
}

function ImageUploader() {
  const [extractedImages, setExtractedImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', event.target.files[0]);

    try {
      const response: AxiosResponse<UploadResponse> = await axios.post<UploadResponse>('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const uploadResponse = response.data;
      console.log('Upload response:', uploadResponse);
      setExtractedImages(uploadResponse.images);
    } catch (error) {
      console.error('Error uploading zip file:', error);
      // Handle error (e.g., show error message to user)
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h1>Image Uploader</h1>
      <input type="file" onChange={handleUpload} accept=".zip" />
      {isLoading && <p>Uploading...</p>}
      {isLoading && <p>Loading...</p>}
      {extractedImages.length > 0 && (
        <div>
          <h2>Extracted Images:</h2>
          {extractedImages.map((image, index) => (
            <img key={index} src={image} alt={\`Extracted \${index}\`} />
          ))}
        </div>
      )}
    </div>
  );
}

export default ImageUploader;
EOL