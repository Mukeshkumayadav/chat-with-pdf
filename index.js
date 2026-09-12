const path = require('path');

require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

const express = require('express');
const next = require('next');

const apiRouter = require('./server/api');

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev, dir: path.join(__dirname, 'client') });
const handleNextRequest = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
    const app = express();

    app.use('/api', apiRouter);
    app.all(/.*/, (req, res) => handleNextRequest(req, res));

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
