const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'products.json');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Email Configuration (using environment variables)
const transporter = nodemailer.createTransport({
    service: 'gmail', // or your preferred service
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Get Products
app.get('/api/products', (req, res) => {
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read data' });
        }
        res.json(JSON.parse(data));
    });
});

// Update Products
app.post('/api/products', (req, res) => {
    const products = req.body;
    fs.writeFile(DATA_FILE, JSON.stringify(products, null, 4), 'utf8', (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to save data' });
        }
        res.json({ success: true });
    });
});

// References API
const REFERENCES_FILE = path.join(__dirname, 'data', 'references.json');

app.get('/api/references', (req, res) => {
    fs.readFile(REFERENCES_FILE, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') return res.json([]);
            return res.status(500).json({ error: 'Failed to read data' });
        }
        res.json(JSON.parse(data));
    });
});

app.post('/api/references', (req, res) => {
    const references = req.body;
    fs.writeFile(REFERENCES_FILE, JSON.stringify(references, null, 4), 'utf8', (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to save data' });
        }
        res.json({ success: true });
    });
});

// File Upload Configuration
const multer = require('multer');
// Use /tmp for Vercel compatibility
const UPLOADS_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, 'uploads');

if (!process.env.VERCEL && !fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

// Upload Offer Endpoint
app.post('/api/upload-offer', upload.single('offerFile'), async (req, res) => {
    const { name, phone, email, notes } = req.body;
    
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_TO || process.env.EMAIL_USER,
            subject: `New Offer Request from ${name}`,
            text: `
                Name: ${name}
                Phone: ${phone}
                Email: ${email}
                Notes: ${notes}
            `,
            attachments: req.file ? [
                {
                    filename: req.file.originalname,
                    path: req.file.path
                }
            ] : []
        };

        await transporter.sendMail(mailOptions);
        
        // Clean up uploaded file after sending
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }

        res.json({ success: true, message: 'Offer submitted and email sent successfully!' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ success: false, error: 'Failed to send email' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
