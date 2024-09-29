const API_BASE_URL = process.env.REACT_APP_API_URL;

// Use API_BASE_URL in your API calls
export const uploadZip = async (formData) => {
  console.log('Uploading to:', `${API_BASE_URL}/api/upload-zip`); // Add this line for debugging
  const response = await fetch(`${API_BASE_URL}/api/upload-zip`, {
    method: 'POST',
    body: formData,
  });
  // ... rest of the function
};

// Other API calls...