# Stage 1: Build Frontend
FROM node:20-alpine as frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build # Output usually goes to /app/frontend/dist

# Stage 2: Build Backend
FROM golang:1.23-alpine
WORKDIR /app
COPY backend/go.mod ./
COPY backend/go.sum* ./
RUN go mod download
COPY backend/ ./

# Copy built frontend from the first stage
# Adjust path if your frontend build output is different
COPY --from=frontend-builder /app/frontend/dist ./static

# Build the application using the path relative to the WORKDIR
RUN go build -o main ./cmd/server

# Expose port
EXPOSE 8080

# Command to run the application
CMD ["./main"] 