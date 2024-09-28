#!/bin/sh

set -e

host="db"
port="5432"
user="user"
password="password"
database="image_gallery"

until PGPASSWORD=$password psql -h "$host" -U "$user" -d "$database" -c '\q'; do
  >&2 echo "Postgres is unavailable - sleeping"
  sleep 1
done

>&2 echo "Postgres is up - executing command"

alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload