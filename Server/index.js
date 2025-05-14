const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

const app = express();
const upload = multer();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

const MD_API_KEY = process.env.METADEFENDER_API_KEY;
if (!MD_API_KEY) {
  throw new Error('Missing METADEFENDER_API_KEY in environment');
}

// === File Scan ===
app.post('/scan-file', upload.single('file'), async (req, res) => {
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
app.get('/scan-url-direct', async (req, res) => {
    try {
      const { encodedUrl } = req.query;
      if (!encodedUrl) {
        return res.status(400).json({ error: 'Missing encodedUrl' });
      }
  
      const response = await axios.get(
        `https://api.metadefender.com/v4/url/${encodedUrl}`,
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

app.get('/sandbox/:sha1', async (req, res) => {
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
app.get('/scan/:hash', async (req, res) => {
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
