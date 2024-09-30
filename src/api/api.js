const API_BASE_URL = process.env.REACT_APP_API_URL;

// Use API_BASE_URL in your API calls
export const uploadZip = async (formData) => {
  console.log('Uploading to:', `${API_BASE_URL}/api/upload-zip`);
  try {
    const response = await fetch(`${API_BASE_URL}/api/upload-zip`, {
      method: 'POST',
      body: formData,
      credentials: 'include',  // Include credentials
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error in uploadZip:', error);
    throw error;
  }
};

// Other API calls...