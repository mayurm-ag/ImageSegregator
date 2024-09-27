import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import './App.css';
import UploadPage from './components/UploadPage';
import GalleryPage from './components/GalleryPage';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>Image Gallery</h1>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;