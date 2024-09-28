FROM python:3.9

WORKDIR /app

# Install netcat and postgresql-client
RUN apt-get update && apt-get install -y netcat-openbsd postgresql-client

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Make the wait-for-it.sh script executable
COPY wait-for-it.sh /wait-for-it.sh
RUN chmod +x /wait-for-it.sh

# Create a startup script
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'alembic upgrade head' >> /start.sh && \
    echo 'uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload' >> /start.sh && \
    chmod +x /start.sh

# Run migrations and start the application
CMD ["/wait-for-it.sh", "db", "/start.sh"]