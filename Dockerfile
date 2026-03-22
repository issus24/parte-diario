FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY . .

EXPOSE 3001

CMD sh -c "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-3001} --app-dir backend"
