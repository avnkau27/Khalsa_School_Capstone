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



---

## Local Setup & Installation

### Prerequisites

Before running this project locally, make sure you have:

1. **Node.js** (v18 or higher) and `npm` installed.
2. **MySQL Server** installed and running locally on port `3306` (along with MySQL Workbench or the MySQL CLI).
3. **Google Cloud Console Credentials:** A Google OAuth 2.0 Client ID and Client Secret with `http://localhost:3000/auth/google/callback` added as an Authorized Redirect URI, and your team's Gmail addresses listed under **Test users**.
4. **Google AI Studio API Key:** A free Gemini API key.
5. **Cloudflare R2 Bucket:** An R2 bucket and an S3-compatible API token with **Object Read & Write** permissions.


### 1. Clone the Repository and Install Dependencies

```bash
git clone https://github.com/avnkau27/Khalsa_School_Capstone.git
cd Khalsa_School_Capstone
npm install --no-audit
```

*Note for Windows PowerShell users:* If PowerShell blocks `npm` with a script execution policy error, run the following command once and confirm with `Y`:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### 2. Create the Local MySQL Database

1. Open **MySQL Workbench** and connect to your local MySQL Server instance (`127.0.0.1`, port `3306`, user `root`).
2. Run the following SQL query to create the database:

```sql
CREATE DATABASE khalsa_school_db;
```

*(Sequelize will automatically create the `Users` and `Photos` tables when you start the server.)*

### 3. Get Your Cloudflare R2 Credentials

1. Log in to the **Cloudflare Dashboard** and navigate to **Storage & databases > R2 > Overview**.
2. Create a bucket (for example, `khalsa-school-plumbing`).
3. Click **Manage** next to **API Tokens**, select **Create Account API token**, grant **Object Read & Write** permissions for your bucket, and copy your **Access Key ID**, **Secret Access Key**, and **S3 API Endpoint URL** (`https://<YOUR_ACCOUNT_ID>.r2.cloudflarestorage.com`).

### 4. Configure Environment Variables

Create a `.env` file in the root directory of the project and add your credentials:

```env
PORT=3000
SESSION_SECRET=replace_with_a_random_secret_string

# Local MySQL Database
DB_NAME=khalsa_school_db
DB_USER=root
DB_PASS=your_mysql_root_password
DB_HOST=127.0.0.1

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Cloudflare R2 (S3-Compatible Storage)
S3_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
S3_BUCKET_NAME=khalsa-school-plumbing
S3_ACCESS_KEY_ID=your_r2_access_key_id
S3_SECRET_ACCESS_KEY=your_r2_secret_access_key
```

### 5. Start the Server

```bash
node server.js
```

Once the terminal displays `Server running at http://localhost:3000`, open `http://localhost:3000` in your browser.

---

## Feature Walkthrough

1. **Authentication (Google OAuth 2.0 & Sessions):** Click **Login with Google** in Box 1 to sign in, verify your profile displays in the header, and test **Logout**.
2. **Database Read/Write & Cloudflare R2 Pipeline:** Upload an image in Box 3. The browser compresses the file (`browser-image-compression`), Express processes it with `multer` and converts it to `.webp` via `sharp`, uploads it to Cloudflare R2 (`@aws-sdk/client-s3`), saves the metadata to MySQL (`Sequelize`), and renders the gallery from the database.
3. **Role-Based Access Control (RBAC):** New accounts default to the `guest` role. Clicking **Admin Delete** on a photo as a `guest` returns a `403 Access Denied` error. Click **Switch Role (Guest / Admin)** in Box 1 to elevate your account to `admin`, then click **Admin Delete** again to confirm deletion succeeds.
4. **Bulk ZIP Export:** Click **Download All as ZIP** in Box 3 to stream a `.zip` archive of stored photos generated by `archiver`.
5. **AI Flyer Generator & PNG Export:** Enter an event name and date in Box 4 to generate HTML flyer markup via `@google/genai` (`gemini-3.8-flash-lite`), then click **Download Flyer as PNG** to export the preview using `html-to-image`.
6. **Sunday Schedule Filtering:** Box 2 uses `date-fns` to calculate and display the next four upcoming Sundays for Langar Seva bookings.
