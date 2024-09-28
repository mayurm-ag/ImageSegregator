import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Spinner from './Spinner';

const API_URL = process.env.REACT_APP_API_URL || 'http://100.64.0.60:8000';

const UploadPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [labels, setLabels] = useState<string[]>(['None']);
  const [newLabel, setNewLabel] = useState('');
  const [uploadComplete, setUploadComplete] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleAddLabel = () => {
    if (newLabel && !labels.includes(newLabel)) {
      setLabels([...labels, newLabel]);
      setNewLabel('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file to upload');
      return;
    }

    setIsLoading(true);
    setProgress(0);
    const formData = new FormData();
    formData.append('zipfile', selectedFile);

    try {
      console.log(`Sending POST request to ${API_URL}/api/upload-zip`);
      const response = await axios.post(`${API_URL}/api/upload-zip`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: any) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);
        },
      });

      if (response.data && response.data.message) {
        setUploadComplete(true);
        // Navigate to the gallery page after successful upload
        navigate('/gallery', { state: { labels } });
      }
    } catch (error) {
      console.error('Error uploading zip file:', error);
      alert('Error uploading zip file. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceed = () => {
    navigate('/gallery', { state: { labels } });
  };

  return (
    <div className="upload-page">
      <h1>Upload Zip File</h1>
      {uploadComplete && (
        <button className="proceed-button" onClick={handleProceed}>
          Proceed to Gallery
        </button>
      )}
      <input type="file" accept=".zip" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={!selectedFile || isLoading}>
        {isLoading ? 'Uploading...' : 'Upload'}
      </button>
      {isLoading && (
        <div className="progress-container">
          <Spinner />
          <progress value={progress} max="100" />
          <p>{progress}% Uploaded</p>
        </div>
      )}
      <div className="label-section">
        <h2>Add Labels</h2>
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Enter new label"
        />
        <button onClick={handleAddLabel}>Add Label</button>
        <div className="label-list">
          <h3>Current Labels:</h3>
          <ul>
            {labels.map((label, index) => (
              <li key={index}>{label}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;