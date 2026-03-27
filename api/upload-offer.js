const { formidable } = require('formidable');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// --- Magic bytes for Excel formats ---
// .xls  (OLE2 Compound Document): D0 CF 11 E0 A1 B1 1A E1
// .xlsx (ZIP-based OOXML):        50 4B 03 04
const XLS_MAGIC = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
const XLSX_MAGIC = Buffer.from([0x50, 0x4B, 0x03, 0x04]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FIELD_LENGTH = 500;
const ALLOWED_EXTENSIONS = ['.xls', '.xlsx'];
const ALLOWED_ORIGINS = ['https://oteks.net', 'https://www.oteks.net', 'https://oteks-web.vercel.app', 'http://localhost:3000'];

function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>{}()\\]/g, '').trim().slice(0, MAX_FIELD_LENGTH);
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length < 254;
}

function validateMagicBytes(filePath, ext) {
    try {
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(8);
        fs.readSync(fd, buf, 0, 8, 0);
        fs.closeSync(fd);

        if (ext === '.xls') {
            return buf.compare(XLS_MAGIC, 0, 8, 0, 8) === 0;
        }
        if (ext === '.xlsx') {
            return buf.compare(XLSX_MAGIC, 0, 4, 0, 4) === 0;
        }
        return false;
    } catch {
        return false;
    }
}

function setCorsHeaders(res, origin) {
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
}

module.exports = async function handler(req, res) {
    const origin = req.headers.origin || '';
    setCorsHeaders(res, origin);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!ALLOWED_ORIGINS.includes(origin) && origin !== '') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    let tempFilePath = null;

    try {
        const form = formidable({
            uploadDir: '/tmp',
            keepExtensions: true,
            maxFileSize: MAX_FILE_SIZE,
            maxFields: 10,
            maxFieldsSize: 2 * 1024,
            filter: ({ mimetype, originalFilename }) => {
                if (!originalFilename) return false;
                const ext = path.extname(originalFilename).toLowerCase();
                if (!ALLOWED_EXTENSIONS.includes(ext)) return false;
                const allowedMimes = [
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/octet-stream'
                ];
                return allowedMimes.includes(mimetype);
            }
        });

        const [fields, files] = await form.parse(req);

        const name = sanitize(fields.name?.[0] || '');
        const email = sanitize(fields.email?.[0] || '');
        const phone = sanitize(fields.phone?.[0] || '');
        const company = sanitize(fields.company?.[0] || '');
        const details = sanitize(fields.details?.[0] || '');

        if (!name || name.length < 2) {
            return res.status(400).json({ error: 'Valid name is required' });
        }
        if (!email || !isValidEmail(email)) {
            return res.status(400).json({ error: 'Valid email is required' });
        }

        let attachment = null;
        const uploadedFile = files.offerFile?.[0];

        if (uploadedFile) {
            tempFilePath = uploadedFile.filepath;
            const ext = path.extname(uploadedFile.originalFilename || '').toLowerCase();

            if (!ALLOWED_EXTENSIONS.includes(ext)) {
                return res.status(400).json({ error: 'Only .xls and .xlsx files are allowed' });
            }

            if (uploadedFile.size > MAX_FILE_SIZE) {
                return res.status(400).json({ error: 'File too large (max 5MB)' });
            }

            if (!validateMagicBytes(tempFilePath, ext)) {
                return res.status(400).json({
                    error: 'Invalid file content. File must be a genuine Excel document.'
                });
            }

            attachment = {
                filename: uploadedFile.originalFilename,
                path: tempFilePath
            };
        }

        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.error('Email credentials not configured');
            return res.status(500).json({ error: 'Email service not configured' });
        }

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            connectionTimeout: 5000,
            greetingTimeout: 5000,
            socketTimeout: 10000
        });

        const recipients = (process.env.EMAIL_TO || process.env.EMAIL_USER)
            .split(',')
            .map(e => e.trim())
            .filter(Boolean);

        const textBody = [
            `Ad Soyad: ${name}`,
            `E-Posta: ${email}`,
            `Telefon: ${phone || 'Belirtilmedi'}`,
            `Firma: ${company || 'Belirtilmedi'}`,
            ``,
            `Detaylar:`,
            details || 'Belirtilmedi'
        ].join('\n');

        const htmlBody = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                <div style="background:#000;padding:20px;text-align:center;">
                    <h2 style="color:#c9a050;margin:0;">OTEKS - Teklif Talebi</h2>
                </div>
                <div style="padding:20px;background:#f9f9f9;border:1px solid #eee;">
                    <table style="width:100%;border-collapse:collapse;">
                        <tr><td style="padding:8px 12px;font-weight:bold;color:#333;">Ad Soyad:</td><td style="padding:8px 12px;color:#555;">${name}</td></tr>
                        <tr style="background:#fff;"><td style="padding:8px 12px;font-weight:bold;color:#333;">E-Posta:</td><td style="padding:8px 12px;color:#555;"><a href="mailto:${email}">${email}</a></td></tr>
                        <tr><td style="padding:8px 12px;font-weight:bold;color:#333;">Telefon:</td><td style="padding:8px 12px;color:#555;">${phone || 'Belirtilmedi'}</td></tr>
                        <tr style="background:#fff;"><td style="padding:8px 12px;font-weight:bold;color:#333;">Firma:</td><td style="padding:8px 12px;color:#555;">${company || 'Belirtilmedi'}</td></tr>
                    </table>
                    <div style="margin-top:16px;padding:12px;background:#fff;border:1px solid #eee;">
                        <p style="font-weight:bold;color:#333;margin:0 0 8px;">Detaylar:</p>
                        <p style="color:#555;margin:0;white-space:pre-wrap;">${details || 'Belirtilmedi'}</p>
                    </div>
                </div>
                <div style="padding:12px;text-align:center;font-size:11px;color:#999;">
                    Bu mesaj oteks.net teklif formu aracılığıyla gönderilmiştir.
                </div>
            </div>`;

        const info = await transporter.sendMail({
            from: `"OTEKS Teklif Formu" <${process.env.EMAIL_USER}>`,
            to: recipients.join(', '),
            replyTo: email,
            subject: `Teklif Talebi: ${name} - ${company || 'Belirtilmedi'}`,
            text: textBody,
            html: htmlBody,
            headers: {
                'X-Mailer': 'OTEKS Web Form',
                'X-Priority': '3',
                'Importance': 'normal'
            },
            attachments: attachment ? [attachment] : []
        });

        console.log('Email sent successfully:', {
            messageId: info.messageId,
            to: recipients,
            accepted: info.accepted,
            rejected: info.rejected,
            response: info.response
        });

        return res.status(200).json({ success: true, message: 'Teklif talebiniz alındı!' });

    } catch (error) {
        console.error('Upload-offer error:', error.message, error.code);

        if (error.code === 'LIMIT_FILE_SIZE' || error.message?.includes('maxFileSize')) {
            return res.status(400).json({ error: 'File too large (max 5MB)' });
        }

        if (error.code === 'EAUTH' || error.message?.includes('auth') || error.message?.includes('credentials')) {
            return res.status(500).json({ error: 'Email authentication failed. Check EMAIL_USER and EMAIL_PASS.' });
        }

        if (error.responseCode === 535 || error.message?.includes('535')) {
            return res.status(500).json({ error: 'Gmail rejected the credentials. Ensure EMAIL_PASS is a valid App Password.' });
        }

        return res.status(500).json({ error: 'Server error: ' + (error.message || 'Unknown error') });

    } finally {
        if (tempFilePath) {
            try { fs.unlinkSync(tempFilePath); } catch {}
        }
    }
};

module.exports.config = {
    api: {
        bodyParser: false,
    },
};
