# Khalsa School Capstone

## Project Description
The SGSS Khalsa School Events Center is a centralized, mobile-friendly web application built for the Sri Guru Singh Sabha Khalsa School community. This features an events center with image uploading and a photo gallery, flyer creation for admins, and langar seva booking.


## Technology Stack
Every library and service listed in our revised project proposal is integrated into this codebase:
### Hosting & Cloud Storage
* **Railway (PaaS)**: Hosts the Node.js/Express web server and MySQL database with automated GitHub deployments.
* **Cloudflare R2 (@aws-sdk/client-s3**): S3-compatible object storage ensuring uploaded event photos and generated flyers persist across server restarts.

### Frontend
* **HTML5, CSS3 & Vanilla JavaScript**: Core client-side structure and interactivity across mobile and desktop devices.
* **Tailwind CSS**: Utility-first CSS framework used for responsive layouts, accessible high-contrast UI components, and customizable flyer templates.

### Backend & API Architecture
* **Node.js & Express.js**: Server runtime and web framework powering our RESTful API endpoints.
* **RESTful API**: Structured routes handling CRUD operations for photos, flyers, users, and bookings.

### Database & ORM
* **MySQL**: Relational database storing user accounts, roles, photo metadata, event categories, flyer drafts, and booking requests.
* **Sequelize ORM & mysql2**: Object-Relational Mapping layer providing schema modeling, migrations, and built-in protection against SQL injection.

### Authentication & Security
* **Passport.js (Google OAuth 2.0) & express-session**: Handles user login and logout via existing Google accounts and enforces Role-Based Access Control (Guest, Teacher, and Admin).
* **dotenv, cors, & helmet**: Manages environment variables and API keys securely, configures Cross-Origin Resource Sharing, and sets protective HTTP headers.

### AI, Media & Date Utilities
* **@google/genai (gemini-2.5-flash**): Parses administrator event forms to generate structured HTML/CSS content for event flyers.
* **browser-image-compression**: Client-side compression that downscales large smartphone images before upload to reduce bandwidth bottlenecks.
* **multer**: Express middleware for handling multipart/form-data single and bulk image uploads.
* **sharp**: Server-side image processing that converts uploads into optimized .webp or .avif formats and generates fast-loading thumbnails.
* **pdfmake**: Converts rendered HTML/CSS flyer previews into downloadable PDF files that can be printed.
* **archiver**: Backend streaming utility that packages selected event photos into downloadable .zip archives.
* **date-fns**: Immutable date utility library used to filter and validate Sunday-only langar seva booking dates.

