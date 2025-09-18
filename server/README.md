# Tech Pack Processing Server

A Node.js backend server for processing tech pack documents and generating HS code suggestions using AI.

## Features

- **File Upload Processing**: Supports PDF, DOC, DOCX, XLS, XLSX files
- **AI-Powered Analysis**: Uses Google Gemini AI for tech pack information extraction
- **HS Code Generation**: Provides HS code suggestions based on garment characteristics
- **RESTful API**: Clean API endpoints for frontend integration
- **Error Handling**: Comprehensive error handling and logging
- **Security**: Includes security middleware and file validation

## Prerequisites

- Node.js 18+
- Google Gemini API key

## Installation

1. Clone the repository and navigate to the server directory:

```bash
cd server
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp env.example .env
```

4. Edit `.env` file and add your configuration:

```env
PORT=3001
NODE_ENV=development
GEMINI_API_KEY=your_gemini_api_key_here
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads
FRONTEND_URL=http://localhost:5173
LOG_LEVEL=info
```

## Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

## API Endpoints

### Upload Tech Pack

- **POST** `/api/techpack/upload`
- **Content-Type**: `multipart/form-data`
- **Body**: `techpack` (file)

**Response:**

```json
{
  "success": true,
  "data": {
    "techPackSummary": {
      "materialPercentage": [
        { "material": "Cotton", "percentage": 60 },
        { "material": "Polyester", "percentage": 40 }
      ],
      "fabricType": "woven",
      "garmentType": "Shirt",
      "gender": "Men's",
      "description": "Men's casual woven shirt with standard fit"
    },
    "fileInfo": {
      "originalName": "techpack.pdf",
      "size": 1048576,
      "type": "application/pdf"
    }
  },
  "message": "Tech pack processed successfully"
}
```

### Health Check

- **GET** `/health`

**Response:**

```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600
}
```

## Architecture

```
src/
├── controllers/     # Request handlers
├── services/        # Business logic
├── middleware/      # Express middleware
├── routes/          # API route definitions
└── index.js         # Application entry point
```

## File Processing

The server supports multiple file formats:

- **PDF**: Extracts text using `pdf-parse`
- **Word Documents**: Extracts text using `mammoth`
- **Excel Files**: Extracts data using `xlsx`

## AI Integration

Uses Google Gemini AI via LangChain for:

- Material composition analysis
- Fabric type identification
- Garment classification
- Description generation
- HS code suggestion preparation

## Security Features

- File type validation
- File size limits
- CORS configuration
- Security headers (Helmet)
- Request compression
- Error sanitization

## Error Handling

- Comprehensive error logging
- Graceful fallbacks for AI failures
- File cleanup after processing
- Structured error responses

## Environment Variables

| Variable         | Description              | Default               |
| ---------------- | ------------------------ | --------------------- |
| `PORT`           | Server port              | 3001                  |
| `NODE_ENV`       | Environment              | development           |
| `GEMINI_API_KEY` | Google Gemini API key    | Required              |
| `MAX_FILE_SIZE`  | Max upload size in bytes | 10485760 (10MB)       |
| `UPLOAD_DIR`     | Upload directory         | uploads               |
| `FRONTEND_URL`   | Frontend URL for CORS    | http://localhost:5173 |
| `LOG_LEVEL`      | Logging level            | info                  |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

ISC
