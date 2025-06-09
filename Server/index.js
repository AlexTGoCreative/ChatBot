const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const mongoose = require('mongoose');
const User = require('./models/User');
const ChatHistory = require('./models/ChatHistory');
const ScanHistory = require('./models/ScanHistory');
const auth = require('./middleware/auth');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const upload = multer();

const corsOptions = {
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

const MD_API_KEY = process.env.METADEFENDER_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!MD_API_KEY) {
  throw new Error('Missing METADEFENDER_API_KEY in environment');
}
if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET in environment');
}

app.post('/auth/register', [
  body('username').isLength({ min: 3 }).trim().escape(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const user = new User({ username, password });
    await user.save();

    const token = jwt.sign({ id: user._id }, JWT_SECRET);
    res.json({
      token,
      user: { id: user._id, username: user.username }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/auth/login', [
  body('username').isLength({ min: 3 }).trim().escape(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;
    
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'User does not exist' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET);
    res.json({
      token,
      user: { id: user._id, username: user.username }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/chat-history', auth, async (req, res) => {
  try {
    const histories = await ChatHistory.find({ userId: req.user.id })
      .sort({ lastUpdated: -1 });
    res.json(histories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/chat-history', auth, async (req, res) => {
  try {
    const { messages, scanData, sandboxData, urlData } = req.body;
    const chatHistory = new ChatHistory({
      userId: req.user.id,
      messages,
      scanData,
      sandboxData,
      urlData
    });
    await chatHistory.save();
    res.json(chatHistory);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// === Update Chat ===

app.put('/chat-history/:chatId', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { messages, scanData, sandboxData, urlData } = req.body;

    const chatHistory = await ChatHistory.findOne({ _id: chatId, userId: req.user.id });
    if (!chatHistory) {
      return res.status(404).json({ message: 'Chat history not found or unauthorized' });
    }

    const updatedChat = await ChatHistory.findByIdAndUpdate(
      chatId,
      {
        messages,
        scanData,
        sandboxData,
        urlData,
        lastUpdated: new Date()
      },
      { new: true }
    );

    res.json(updatedChat);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/chat-history', auth, async (req, res) => {
  try {
    await ChatHistory.deleteMany({ userId: req.user.id });
    res.json({ message: 'Chat history cleared' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// === File Scan ===
app.post('/scan-file', auth, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const response = await axios.post(
      'https://api.metadefender.com/v4/file',
      file.buffer,
      {
        headers: {
          'apikey': MD_API_KEY,
          'Content-Type': 'application/octet-stream',
          'filename': file.originalname
        }
      }
    );

    const hash = response.data?.data_id;
    res.json({ message: 'File scan initiated', hash });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// === Direct URL Scan ===
app.get('/scan-url-direct', auth, async (req, res) => {
    try {
      const { encodedUrl } = req.query;
      if (!encodedUrl) {
        return res.status(400).json({ error: 'Missing encodedUrl' });
      }

      const encodedForAPI = encodeURIComponent(encodedUrl);
  
      const response = await axios.get(
        `https://api.metadefender.com/v4/url/${encodedForAPI}`,
        {
          headers: {
            'apikey': MD_API_KEY,
          },
        }
      );
  
      res.json(response.data);
    } catch (error) {
      console.error("Eroare scan-url-direct:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json({ error: error.message });
    }
});

// === Get Sandbox ===
app.get('/sandbox/:sha1', auth, async (req, res) => {
  const { sha1 } = req.params;

  try {
    const response = await axios.get(`https://api.metadefender.com/v4/hash/${sha1}/sandbox`, {
      headers: {
        apikey: MD_API_KEY,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching sandbox data:', error.message);
    res.status(500).json({ error: 'Failed to fetch sandbox data from Metadefender.' });
  }
});
  
// === Scan Status ===
app.get('/scan/:hash', auth, async (req, res) => {
  try {
    const { hash } = req.params;
    const response = await axios.get(
      `https://api.metadefender.com/v4/file/${hash}`,
      { headers: { apikey: MD_API_KEY } }
    );

    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// === Scan History ===
app.get('/scan-history', auth, async (req, res) => {
  try {
    const scanHistory = await ScanHistory.find({ userId: req.user.id }).sort({ timestamp: -1 });
    res.json(scanHistory);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/scan-history', auth, async (req, res) => {
  try {
    const scanHistory = new ScanHistory({
      ...req.body,
      userId: req.user.id
    });
    await scanHistory.save();
    res.json(scanHistory);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/scan-history', auth, async (req, res) => {
  try {
    await ScanHistory.deleteMany({ userId: req.user.id });
    res.json({ message: 'Scan history cleared' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
