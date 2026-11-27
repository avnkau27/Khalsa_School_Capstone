require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const multer = require('multer');
const sharp = require('sharp');
//const archiver = require('archiver');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { GoogleGenAI } = require('@google/genai');
const { sequelize, User, Event, Photo } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & parsing middleware (CSP disabled so Tailwind CDN & inline scripts run smoothly in prototype)
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

// Session & Passport Google OAuth 2.0 setup
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const [user] = await User.findOrCreate({
          where: { googleId: profile.id },
          defaults: {
            email: profile.emails[0].value,
            name: profile.displayName,
            role: 'Member',
          },
        });
        if (!user.isActive) return done(null, false);
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findOne({ where: { id, isActive: true } });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

app.get('/flyer.html', (req, res, next) => {
  if (!req.isAuthenticated() || req.user.role !== 'Admin') {
    return res.redirect('/');
  }
  next();
});

app.use(express.static('public'));
app.use('/vendor', express.static('node_modules'));

// S3 Client (Cloudflare R2 or Local MinIO) & Gemini AI Client
const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_ENDPOINT.includes('localhost'),
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const upload = multer({ storage: multer.memoryStorage() });

// RBAC Middleware
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.isAuthenticated() || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}.` });
    }
    next();
  };
}

function isPhotoApprover(req) {
  return req.isAuthenticated() && ['Admin', 'Approver'].includes(req.user.role);
}

function canManageUnpublishedEvents(req) {
  return isPhotoApprover(req);
}

function requireAdmin(req, res, next) {
  if (!req.isAuthenticated() || req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
  next();
}

// --- AUTH & RBAC ROUTES ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => res.redirect('/')
);

app.post('/auth/logout', (req, res) => {
  req.logout(() => res.json({ message: 'Logged out' }));
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.user || null });
});

// --- PHOTO UPLOAD, DB READ/WRITE, & ZIP EXPORT ROUTES ---
app.get('/api/events', async (req, res) => {
  const where = canManageUnpublishedEvents(req) ? {} : { isPublished: true };
  const events = await Event.findAll({
    where,
    attributes: ['id', 'eventName', 'description', 'location', 'dateStart', 'dateEnd'],
    order: [['dateStart', 'ASC']],
  });
  res.json(events);
});

app.get('/api/photos', async (req, res) => {
  const canApprove = isPhotoApprover(req);
  const eventInclude = {
    model: Event,
    as: 'event',
    attributes: ['id', 'eventName', 'isPublished'],
  };
  if (!canApprove) eventInclude.where = { isPublished: true };
  const photos = await Photo.findAll({
    where: canApprove ? {} : { status: 'Approved' },
    include: [eventInclude],
    order: [['createdAt', 'DESC']],
  });
  res.json(photos);
});

app.post('/api/photos', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const eventId = Number(req.body.eventId);
    if (!Number.isInteger(eventId) || eventId < 1) {
      return res.status(400).json({ error: 'A valid eventId is required.' });
    }
    const title = req.body.title?.trim() || null;
    const guestName = req.isAuthenticated() ? null : (req.body.guestName?.trim() || null);
    if (title && title.length > 255) {
      return res.status(400).json({ error: 'Photo title must be 255 characters or fewer.' });
    }
    if (guestName && guestName.length > 150) {
      return res.status(400).json({ error: 'Guest name must be 150 characters or fewer.' });
    }

    const event = await Event.findByPk(eventId);
    if (!event || (!event.isPublished && !canManageUnpublishedEvents(req))) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    // Convert image to WebP using sharp
    const webpBuffer = await sharp(req.file.buffer).resize(800).webp({ quality: 80 }).toBuffer();
    const s3Key = `photos/${Date.now()}.webp`;

    // Upload to Cloudflare R2 / MinIO
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key,
        Body: webpBuffer,
        ContentType: 'image/webp',
      })
    );

    // Save metadata to MySQL via Sequelize
    const photo = await Photo.create({
      title,
      s3Key,
      url: `/api/photos/file/${encodeURIComponent(s3Key)}`,
      eventId,
      uploaderId: req.isAuthenticated() ? req.user.id : null,
      guestName,
      status: 'Pending',
    });

    res.status(201).json(photo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Stream image from S3/R2 so private buckets still render cleanly in the browser
app.get('/api/photos/file/:key', async (req, res) => {
  try {
    const data = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: req.params.key,
      })
    );
    res.setHeader('Content-Type', 'image/webp');
    data.Body.pipe(res);
  } catch (err) {
    res.status(404).send('Image not found');
  }
});

// Admin-only Delete route (demonstrates RBAC enforcement)
app.delete('/api/photos/:id', requireAdmin, async (req, res) => {
  await Photo.destroy({ where: { id: req.params.id } });
  res.json({ message: 'Photo deleted by admin' });
});

app.post('/api/photos/:id/approve', requireRole('Admin', 'Approver'), async (req, res) => {
  const photo = await Photo.findByPk(req.params.id);
  if (!photo) return res.status(404).json({ error: 'Photo not found.' });
  if (photo.status !== 'Approved') {
    photo.status = 'Approved';
    photo.approverId = req.user.id;
    photo.approvedAt = new Date();
    await photo.save();
  }
  res.json({ message: 'Photo approved.', photo });
});

// Bulk ZIP download using archiver
app.get('/api/photos/zip', async (req, res) => {
  const { default: archiver } = await import('archiver');
  const photos = await Photo.findAll({
    where: { status: 'Approved' },
    include: [{
      model: Event,
      as: 'event',
      where: { isPublished: true },
      attributes: [],
    }],
  });
  res.attachment('khalsa-school-photos.zip');
  const archive = archiver('zip');
  archive.pipe(res);

  for (const photo of photos) {
    const data = await s3.send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: photo.s3Key })
    );
    archive.append(data.Body, { name: `${photo.id}-${photo.title}.webp` });
  }
  await archive.finalize();
});

// --- AI FLYER GENERATOR ROUTE (With Automatic Model Fallback, Admin Only) ---
app.post('/api/flyer', requireAdmin, async (req, res) => {
  const { eventName, eventDate } = req.body;
  const prompt = `Generate a clean, colorful Tailwind CSS HTML snippet (no markdown backticks, just raw HTML inside a single <div>) for a Sikh Khalsa School flyer. Event: ${eventName}, Date: ${eventDate}.`;

  // Try the fastest, least-congested free-tier models in order
  const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });
      return res.json({ html: response.text, modelUsed: model });
    } catch (err) {
      console.warn(`Model ${model} failed (${err.status || err.message}), trying next...`);
    }
  }

  res.status(503).json({ error: 'All Gemini free-tier models are temporarily busy. Please try again in a few seconds.' });
});

// The database schema is provisioned separately; authenticate without changing it.
sequelize.authenticate().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Unable to connect to the database:', err);
  process.exitCode = 1;
});