# Image Gallery Application

This is a web-based image gallery application that allows users to upload and view images.

## Prerequisites

- Docker
- Docker Compose

## Setup and Deployment

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/image-gallery-app.git
   cd image-gallery-app
   ```

2. Build and start the Docker containers:
   ```
   docker-compose up --build
   ```

3. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000

## Usage

1. Open the frontend application in your web browser.
2. Use the file input to select one or more images.
3. Click the "Upload Images" button to upload the selected images.
4. The uploaded images will be displayed in the gallery below.

## Troubleshooting

- If you encounter any issues with database connections, ensure that the PostgreSQL container is running and the connection string in the backend configuration is correct.
- For any other issues, check the Docker logs for each service:
  ```
  docker-compose logs frontend
  docker-compose logs backend
  docker-compose logs db
  ```

## Scaling

To handle a large number of images, consider the following:

1. Implement pagination for the image gallery.
2. Use a cloud storage service (e.g., AWS S3) for storing images instead of local storage.
3. Implement caching mechanisms to reduce database load.
4. Consider using a CDN for serving images to end-users.

## Contributing

Please read CONTRIBUTING.md for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the LICENSE.md file for details.