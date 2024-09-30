import React, { useState } from 'react';
import { uploadZip } from '../api/api';

function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus('Please select a file first.');
      return;
    }

    try {
      setUploadStatus('Uploading...');
      const formData = new FormData();
      formData.append('zipfile', file);  // Change 'file' to 'zipfile' to match the backend expectation

      const response = await uploadZip(formData);
      console.log('Upload successful:', response);
      setUploadStatus('Upload successful!');
    } catch (error) {
      console.error('Error uploading zip file:', error);
      if (error instanceof Error) {
        setUploadStatus(`Upload failed: ${error.message}`);
      } else {
        setUploadStatus('An unexpected error occurred. Please try again.');
      }
    }
  };

  return (
    <div>
      <h1>Upload ZIP File</h1>
      <input type="file" accept=".zip" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={!file}>
        Upload
      </button>
      {uploadStatus && <p>{uploadStatus}</p>}
    </div>
  );
}

export default UploadPage;