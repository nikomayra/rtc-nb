FROM golang:1.23-alpine

WORKDIR /app

# Copy go mod file first
COPY go.mod ./

# Copy go sum if it exists, but don't fail if it doesn't
COPY go.sum* ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN go build -o main ./cmd/server

# Expose port
EXPOSE 8080

# Command to run the application
CMD ["./main"] 