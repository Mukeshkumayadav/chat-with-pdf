const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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

        await qdrant.createPayloadIndex('pdf-doc', { field_name: 'fileHash', field_schema: 'keyword' });

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

        const originalName = String(req.file.originalname || '');
        const isPdf = req.file.mimetype === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            return res.status(400).send('Only PDF files are allowed.');
        }

        if (!req.body.question) {
            return res.status(400).send('No question provided');
        }

        const t0 = Date.now();
        const dataBuffer = fs.readFileSync(req.file.path);
        const fileHash = crypto.createHash('sha256').update(dataBuffer).digest('hex');

        const alreadyIndexed = await qdrant.scroll('pdf-doc', {
            filter: { must: [{ key: 'fileHash', match: { value: fileHash } }] },
            limit: 1
        });
        const t1 = Date.now();
        console.log(`[timing] fileHash+scroll check: ${t1 - t0}ms (cached=${alreadyIndexed.points.length > 0})`);

        if (alreadyIndexed.points.length === 0) {
            const pdfData = await pdfParse(dataBuffer);
            const text = pdfData.text || '';

            const chunks = splitPdfTextIntoChunks(text, 1200, 8);
            const t2 = Date.now();
            console.log(`[timing] pdf-parse+chunk: ${t2 - t1}ms (chunks=${chunks.length})`);

            if (chunks.length === 0) {
                return res.status(400).send('No readable text found in the uploaded PDF. Please upload a PDF with selectable text or a different file.');
            }

            const chunkEmbeddings = await Promise.all(
                chunks.map(async (chunk) => ({
                    text: chunk,
                    embedding: await createEmbedding(chunk)
                }))
            );
            const t3 = Date.now();
            console.log(`[timing] embed ${chunks.length} chunks (parallel): ${t3 - t2}ms`);

            const points = chunkEmbeddings.map((item, index) => ({
                id: index + 1,
                vector: item.embedding,
                payload: {
                    text: item.text,
                    fileHash
                }
            }));

            // The collection only ever holds one document's chunks, so clear
            // the previous file's points before storing the new file's ones.
            await qdrant.delete('pdf-doc', { filter: {} });
            await qdrant.upsert('pdf-doc', {
                points,
            });
            const t4 = Date.now();
            console.log(`[timing] qdrant delete+upsert: ${t4 - t3}ms`);
        }

        const question = req.body.question;
        const tq0 = Date.now();
        const questionEmbedding = await createEmbedding(question);
        const tq1 = Date.now();
        console.log(`[timing] embed question: ${tq1 - tq0}ms`);

        const searchResult = await qdrant.query('pdf-doc', {
            query: questionEmbedding,
            limit: 1,
            with_payload: true
        });
        const tq2 = Date.now();
        console.log(`[timing] qdrant search: ${tq2 - tq1}ms`);

        if (!searchResult.points || searchResult.points.length === 0) {
            return res.status(400).send('No relevant content was found in the PDF for that question.');
        }

        const bestChunk = searchResult.points[0]?.payload?.text ?? '';

        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash-lite',
            contents: `Answer the question using the context: ${bestChunk} and Question is : ${question}`
        });
        const tq3 = Date.now();
        console.log(`[timing] generateContent: ${tq3 - tq2}ms`);
        console.log(`[timing] TOTAL: ${tq3 - t0}ms`);

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
