import React, { useState, useMemo } from 'react';

function ImageGallery({ images, labels, onLabelChange }) {
  const [currentPage, setCurrentPage] = useState(1);
  const imagesPerPage = 10; // Adjust this value as needed

  const totalPages = Math.ceil(images.length / imagesPerPage);

  const currentImages = useMemo(() => {
    const startIndex = (currentPage - 1) * imagesPerPage;
    return images.slice(startIndex, startIndex + imagesPerPage);
  }, [images, currentPage]);

  return (
    <div>
      {currentImages.map((image) => (
        <div key={image.id}>
          <img src={image.url} alt={image.name} />
          <select
            value={labels[image.id] || ''}
            onChange={(e) => onLabelChange(image.id, e.target.value)}
          >
            <option value="">Select a label</option>
            {/* Add your label options here */}
          </select>
        </div>
      ))}
      
      <div className="pagination-info">
        <span>Total Images: {images.length}</span>
        <div className="pagination">
          <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
            First
          </button>
          <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
            Prev
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
            Next
          </button>
          <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
            Last
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImageGallery;