import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { processAudio } from '../utils/ffmpeg.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Uploads
const uploadDir = path.join(__dirname, '..', 'uploads');
const rawDir = path.join(uploadDir, 'raw');
const stemsDir = path.join(uploadDir, 'stems');

// Ensure directories exist
[uploadDir, rawDir, stemsDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, rawDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({ storage });

// Processing Route
router.post('/separate', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file uploaded' });
        }

        const jobId = Date.now().toString();
        const jobDir = path.join(stemsDir, jobId);

        // Process Audio
        // Note: In a real app, this should be a background job (Queue)
        // But for this MVP, we await it (might timeout on large files)
        const results = await processAudio(req.file.path, jobDir);

        // Construct URLs
        // Assumes /uploads is served statically
        const baseUrl = `${req.protocol}://${req.get('host')}/uploads/stems/${jobId}`;

        const stems = {};
        results.forEach(r => {
            stems[r.stem] = `${baseUrl}/${r.filename}`;
        });

        res.json({ success: true, jobId, stems });

        // Optional: Cleanup raw file
        // fs.unlinkSync(req.file.path);

    } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({ error: 'Failed to process audio', details: error.message });
    }
});

export default router;
