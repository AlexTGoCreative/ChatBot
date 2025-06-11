FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Set environment variables for Hugging Face and Transformers cache
ENV HF_HOME=/app/.hf
ENV TRANSFORMERS_CACHE=/app/.hf/cache
ENV HF_DATASETS_CACHE=/app/.hf/datasets
ENV HF_METRICS_CACHE=/app/.hf/metrics

# Install system dependencies
RUN apt-get update && apt-get install -y build-essential && apt-get clean

# Create the cache directories and set permissions
RUN mkdir -p /app/.hf/cache /app/.hf/datasets /app/.hf/metrics && chmod -R 777 /app/.hf

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy the application code
COPY . .

# Ensure all files in /app have full permissions
RUN chmod -R 777 /app

# Expose FastAPI port
EXPOSE 7860

# Start FastAPI app
CMD ["uvicorn", "chat_api:app", "--host", "0.0.0.0", "--port", "7860"]
