const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const { QdrantClient } = require('@qdrant/js-client-rest');
const { splitPdfTextIntoChunks } = require('./textUtils');

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

const requiredEnv = ['GEMINI_API_KEY', 'QDRANT_URL', 'QDRANT_API_KEY'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
    console.warn(`Missing required environment variables: ${missingEnv.join(', ')}`);
}

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

function assertServerConfig() {
    const missing = requiredEnv.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing server configuration: ${missing.join(', ')}`);
    }
}

async function createEmbedding(text) {
    const response = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text,
    });

    return response.embeddings[0].values;
}

const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY
});

router.get('/create-collection', async (req, res) => {
    try {
        try {
            await qdrant.getCollection('pdf-doc');
            return res.send('Collection already exists');
        } catch (getCollectionError) {
            const statusCode = getCollectionError?.status || getCollectionError?.response?.status;
            const message = String(getCollectionError?.message || '');

            if (statusCode !== 404 && !message.toLowerCase().includes('not found')) {
                throw getCollectionError;
            }
        }

        await qdrant.createCollection('pdf-doc', {
            vectors: {
                size: 3072,
                distance: 'Cosine'
            }
        });

        res.send('Collection created successfully');
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

router.post('/upload', upload.single('pdf'), async (req, res) => {
    try {
        assertServerConfig();

        if (!req.file) {
            return res.status(400).send('No PDF file uploaded');
        }
        if (!req.body.question) {
            return res.status(400).send('No question provided');
        }

        const dataBuffer = fs.readFileSync(req.file.path);

        const pdfData = await pdfParse(dataBuffer);
        const text = pdfData.text || '';

        const chunks = splitPdfTextIntoChunks(text, 1200, 8);

        if (chunks.length === 0) {
            return res.status(400).send('No readable text found in the uploaded PDF. Please upload a PDF with selectable text or a different file.');
        }

        const chunkEmbeddings = await Promise.all(
            chunks.map(async (chunk) => ({
                text: chunk,
                embedding: await createEmbedding(chunk)
            }))
        );

        const points = chunkEmbeddings.map((item, index) => ({
            id: index + 1,
            vector: item.embedding,
            payload: {
                text: item.text
            }
        }));

        await qdrant.upsert('pdf-doc', {
            points,
        });

        const question = req.body.question;
        const questionEmbedding = await createEmbedding(question);

        const searchResult = await qdrant.query('pdf-doc', {
            query: questionEmbedding,
            limit: 1,
            with_payload: true
        });

        if (!searchResult.points || searchResult.points.length === 0) {
            return res.status(400).send('No relevant content was found in the PDF for that question.');
        }

        const bestChunk = searchResult.points[0]?.payload?.text ?? '';

        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash-lite',
            contents: `Answer the question using the context: ${bestChunk} and Question is : ${question}`
        });

        res.send(response.text);
    } catch (err) {
        console.log(err);
        const message = err?.message || 'Something went wrong while processing the PDF.';
        res.status(500).send(message);
    } finally {
        if (req.file) {
            fs.unlink(req.file.path, () => { });
        }
    }
});

module.exports = router;
