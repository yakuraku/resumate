# BirdTag-AWS - Technical Summary

## Overview
BirdTag-AWS is a serverless AI-powered bird detection and media management platform built on AWS. It automatically identifies bird species in uploaded images, videos, and audio files using YOLO object detection and BirdNET audio analysis, stores results in DynamoDB, and exposes a full-featured REST API via API Gateway. The system includes a polished single-page frontend with AWS Cognito authentication, presigned URL uploads, advanced tag-based search, and CRUD operations on media files.

## Project Type
Serverless ML Pipeline & Full-Stack Web Application (AWS-native)

## Tech Stack

### Languages
- **Python 3.11**: All backend Lambda functions, ML inference, file processing
- **JavaScript (ES6+)**: Frontend SPA with async/await, DOM manipulation, Fetch API
- **HTML5/CSS3**: Responsive glassmorphism UI with CSS custom properties, animations, and media queries

### Frameworks & Libraries
- **Ultralytics (YOLOv8)**: Real-time bird species detection in images and video frames
- **Supervision**: Bounding box annotation, object tracking (ByteTrack), video processing utilities
- **OpenCV (cv2)**: Image/video I/O, frame capture, thumbnail generation, image resizing
- **TensorFlow 2.13**: Deep learning backend for model inference
- **PyTorch 2.0.1 + TorchVision 0.15.2**: YOLO model runtime (CPU-optimized builds)
- **Librosa 0.10.1**: Audio signal processing for bird call analysis
- **Roboflow**: Model training/dataset management integration
- **Boto3 1.26.137**: AWS SDK for S3, DynamoDB, and SNS operations
- **Pillow 9.5.0**: Image format handling and processing
- **NumPy / Matplotlib**: Numerical computation and visualization
- **Font Awesome 6.4.0**: Frontend icon library

### Databases & Storage
- **Amazon DynamoDB**: Two tables — `birdtag-files` (file metadata, tags, URLs) and `birdtag-tags` (species-to-file index with counts, partition key: species, sort key: file_id)
- **Amazon S3**: Three buckets — media storage (`birdtag-media-storage`), thumbnails (`birdtag-thumbnails`), and static website hosting (`birdtag-website`)

### Cloud & DevOps
- **AWS Lambda**: 4 independent Lambda functions (containerized ML processor + 3 lightweight handlers)
- **Amazon API Gateway**: RESTful API with CORS support, routing to Lambda functions
- **Amazon Cognito**: OAuth 2.0 user authentication with sign-up/sign-in/sign-out flows
- **Amazon S3 Event Notifications**: Automatic trigger on file upload to invoke ML processing
- **Amazon SNS**: Push notifications on successful bird detection
- **Amazon ECR**: Container registry for the ML Lambda (Docker-based deployment)
- **Docker**: Custom container image based on `public.ecr.aws/lambda/python:3.11` with system dependencies (OpenGL, graphics libs)
- **S3 Static Website Hosting**: Frontend deployment as a single-page application

### APIs & Integrations
- **S3 Presigned URLs**: Secure direct-to-S3 uploads bypassing API Gateway's 6MB limit (up to 100MB)
- **Cognito OAuth2 Token Exchange**: Authorization code flow with JWT parsing
- **BirdNET-Analyzer**: Audio-based bird species identification (integrated via sys.path)

## Architecture Highlights
- **Event-driven serverless pipeline**: S3 upload triggers Lambda automatically — zero server management, pay-per-invocation
- **4 microservice Lambda functions** with single-responsibility design:
  - `birdtag-lambda-container`: Containerized ML inference (YOLO + BirdNET) triggered by S3 events
  - `birdtag-file-upload`: Dual upload strategy (base64 for small files, presigned URLs for large files up to 100MB)
  - `birdtag-query-handler`: 7-endpoint search/query API with presigned URL generation for secure media access
  - `birdtag-file-manager`: Tag CRUD operations and file deletion with cascading cleanup (S3 + DynamoDB)
- **Multi-modal ML processing**: Single pipeline handles images (YOLO per-frame), video (YOLO + ByteTrack with frame sampling every 30th frame, capped at 300 frames for Lambda timeout), and audio (BirdNET)
- **Infinite loop prevention**: Thumbnail bucket isolation, filename pattern matching, folder-based skip rules, and minimum file size checks prevent recursive Lambda triggers
- **Graceful degradation**: Fallback filename-based detection when ML models fail, ensuring consistent API responses
- **Dual-index DynamoDB design**: Files table stores denormalized tag maps; Tags table enables efficient species-first queries with count-based filtering
- **Pre-signed URL security model**: All media served through time-limited presigned URLs (1-hour expiry) rather than public S3 access

## Key Features Implemented
1. **AI Bird Detection Pipeline**: Automated YOLO-based species detection on upload with confidence thresholding (>50%), bounding box annotation, and species counting per file
2. **Video Frame Analysis**: Intelligent frame sampling (every 30th frame) with ByteTrack object tracking to identify unique bird instances across video
3. **Dual Upload Strategy**: Base64 upload for files under API Gateway limits + presigned URL generation for large files up to 100MB, with file type validation (20+ supported formats)
4. **Advanced Species Search**: Multi-criteria tag search supporting species + minimum count queries (e.g., "files with >= 2 Crows AND >= 1 Pigeon")
5. **Thumbnail System**: Auto-generated 200px thumbnails stored in a separate S3 bucket with bidirectional URL resolution (thumbnail-to-full and reverse)
6. **Tag Management API**: Add/remove species tags with count tracking, supporting batch operations across multiple files simultaneously
7. **File Deletion with Cascading Cleanup**: Removes S3 objects (original + thumbnail), DynamoDB file record, and all associated tag index entries
8. **Cognito Authentication**: Full OAuth 2.0 flow with token storage, authenticated API requests, and session management
9. **SNS Notifications**: Real-time push notifications when new bird media is processed with species detection results
10. **Responsive Glass-Morphism UI**: Single-page application with animated backgrounds, media-type-aware result display (image thumbnails, video/audio players), and copy-to-clipboard functionality

## Technical Complexity Indicators
- **Codebase Scale**: Medium — 7 Python source files (~1,700 lines backend), 1 comprehensive HTML/JS/CSS frontend (~2,050 lines), Docker configuration
- **Lambda Function Count**: 4 independent functions with distinct IAM roles and triggers
- **Integration Complexity**: 6 AWS services (Lambda, S3, DynamoDB, API Gateway, Cognito, SNS) + 2 ML frameworks (YOLO, BirdNET)
- **Data Complexity**: 2 DynamoDB tables with cross-table consistency management, 3 S3 buckets with event routing
- **API Endpoints**: ~10 distinct operations (search, advanced search, thumbnail lookup, upload, presigned upload, tag add, tag remove, file delete, similar search, CORS preflight)
- **ML Model Integration**: Custom-trained YOLO model (.pt format) deployed in containerized Lambda with CPU-optimized PyTorch
- **Testing**: Manual testing via built-in UI test panels (Test API sections with pre-populated JSON payloads)
- **CI/CD**: Docker-based deployment to ECR → Lambda container image

## Quantifiable Metrics (Estimated)
- **10 API endpoints** served through API Gateway with CORS and authentication
- **4 Lambda functions** forming a microservice architecture
- **6 AWS services** orchestrated in an event-driven pipeline
- **3 media types** supported (image, video, audio) with type-specific processing logic
- **20+ file formats** validated and accepted for upload (.jpg, .png, .mp4, .wav, .mp3, etc.)
- **100MB max upload** supported via presigned URL strategy, bypassing API Gateway's 6MB limit
- **~1,700 lines** of Python backend code across 7 Lambda handler files
- **~2,050 lines** of frontend code (HTML + CSS + JavaScript) in a single SPA
- **2 DynamoDB tables** with dual-index design for efficient species queries
- **3 S3 buckets** with event-driven trigger isolation

## Resume-Ready Bullet Points
> These are draft bullet points optimized for ATS and impact. Use as starting points.

- Architected a serverless bird detection platform on AWS using 4 Lambda functions, S3 event triggers, DynamoDB, API Gateway, Cognito, and SNS, enabling automated ML inference on uploaded media files
- Deployed a custom-trained YOLOv8 object detection model in a containerized AWS Lambda function using Docker and ECR, achieving real-time bird species identification with configurable confidence thresholds
- Engineered a multi-modal processing pipeline handling images, video (frame-sampled with ByteTrack object tracking), and audio (BirdNET integration) through a unified serverless architecture
- Designed a dual-index DynamoDB schema with a files table and a species-partitioned tags table, enabling complex multi-criteria search queries (e.g., "files containing >= N instances of species X AND Y")
- Implemented a presigned URL upload system to bypass API Gateway's 6MB payload limit, supporting direct-to-S3 uploads of media files up to 100MB with file type validation and size enforcement
- Built a 10-endpoint REST API with tag management (add/remove/replace), advanced search, thumbnail resolution, and cascading file deletion across S3 and DynamoDB
- Developed infinite-loop prevention mechanisms for S3-triggered Lambdas using bucket isolation, filename pattern detection, folder-based skip rules, and minimum file size thresholds
- Created a responsive single-page application with glassmorphism UI, AWS Cognito OAuth 2.0 authentication, and media-type-aware result rendering for images, videos, and audio files

## Keywords for ATS
AWS Lambda, Amazon S3, Amazon DynamoDB, Amazon API Gateway, Amazon Cognito, Amazon SNS, Amazon ECR, Docker, Serverless, Python, JavaScript, HTML5, CSS3, YOLOv8, Ultralytics, TensorFlow, PyTorch, OpenCV, Computer Vision, Object Detection, Deep Learning, Machine Learning, YOLO, ByteTrack, Object Tracking, BirdNET, Audio Processing, Librosa, REST API, CORS, OAuth 2.0, JWT, Presigned URLs, Base64 Encoding, Event-Driven Architecture, Microservices, Containerized Lambda, Boto3, Image Processing, Video Processing, Thumbnail Generation, NoSQL, DynamoDB Scan, DynamoDB Query, S3 Event Notifications, CI/CD, Infrastructure as Code, Single Page Application, Responsive Design, Glassmorphism UI, Full-Stack Development, Cloud-Native, Pay-Per-Use

## Notes for Resume Tailoring
- **Best suited for roles involving**: Cloud Engineering (AWS), ML/AI Engineering, Backend/Serverless Development, Full-Stack Development, Computer Vision
- **Strongest demonstration of**: AWS serverless architecture design, ML model deployment to production, event-driven system design
- **Potential talking points for interviews**:
  - How you solved the infinite-loop problem when S3 triggers Lambda which writes thumbnails back to S3
  - Trade-offs of containerized Lambda vs. layer-based Lambda for ML model deployment (model size, cold start, dependency management)
  - Frame sampling strategy for video processing within Lambda's 15-minute timeout constraint
  - DynamoDB schema design for efficient species-based queries vs. file-based lookups (dual-table approach)
  - Presigned URL strategy to overcome API Gateway payload limits while maintaining security
  - Graceful degradation pattern: ML model failure → filename-based fallback detection
