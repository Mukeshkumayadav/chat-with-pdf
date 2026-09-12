const express = require('express')
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');
const { QdrantClient } = require('@qdrant/js-client-rest');
require('dotenv').config();


const app = express();
app.use(cors());
const upload = multer({ dest: 'uploads/' });

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

async function createEmbedding(text) {
    const response = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text,
    });

    return response.embeddings[0].values;

};

const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY
});


function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        magA += vecA[i] * vecA[i];
        magB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
}

app.get('/', (req, res) => {
    res.send('Hello, Mukesh!');
})

app.get('/create-collection', async (req, res) => {
    try {
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

app.post('/upload', upload.single('pdf'), async (req, res) => {
    console.log(req.body); // Log the uploaded file information

    try {
        if (!req.file) {
            return res.status(400).send('No PDF file uploaded');
        }
        if (!req.body.question) {
            return res.status(400).send('No question provided');
        }

        const dataBuffer = fs.readFileSync(req.file.path);

        const pdfData = await pdfParse(dataBuffer);
        const text = pdfData.text;

        const chunks = text.split('\n\n').filter(chunk => chunk.trim() != '');



        const chunkEmbeddings = [];
        for (const chunk of chunks) {
            const embedding = await createEmbedding(chunk);

            chunkEmbeddings.push({
                text: chunk,
                embedding
            });
        }


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


        const bestChunk = searchResult.points[0]?.payload?.text ?? '';

        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash-lite',
            contents: `Answer the question using the context: ${bestChunk} and Question is : ${question}`
        });

        res.send(response.text);



    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    } finally {
        if (req.file) {
            fs.unlink(req.file.path, () => { });
        }
    }



});



app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
