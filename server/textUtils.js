function splitPdfTextIntoChunks(text, maxChunkLength = 1200, maxChunks = 8) {
    if (!text || !text.trim()) return [];

    const normalized = text
        .replace(/\r\n/g, '\n')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+\n\s+/g, '\n')
        .trim();

    const paragraphs = normalized
        .split(/\n\s*\n+/)
        .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
        .filter(Boolean);

    if (!paragraphs.length) return [];

    const chunks = [];
    let current = '';

    const flushCurrent = () => {
        if (current.trim()) {
            chunks.push(current.trim());
            current = '';
        }
    };

    const addLargeParagraph = (paragraph) => {
        const words = paragraph.split(/\s+/);
        let buffer = '';

        for (const word of words) {
            const candidate = buffer ? `${buffer} ${word}` : word;
            if (candidate.length <= maxChunkLength) {
                buffer = candidate;
                continue;
            }

            if (buffer) {
                chunks.push(buffer.trim());
                buffer = word;
            } else {
                chunks.push(word.slice(0, maxChunkLength).trim());
                const remainder = word.slice(maxChunkLength).trim();
                if (remainder) buffer = remainder;
            }
        }

        if (buffer) current = buffer.trim();
    };

    for (const paragraph of paragraphs) {
        if (paragraph.length <= maxChunkLength) {
            const candidate = current ? `${current} ${paragraph}` : paragraph;
            if (candidate.length <= maxChunkLength) {
                current = candidate;
                continue;
            }

            flushCurrent();
            current = paragraph;
            continue;
        }

        if (current) {
            flushCurrent();
        }

        addLargeParagraph(paragraph);

        if (chunks.length >= maxChunks) {
            flushCurrent();
        }
    }

    flushCurrent();

    while (chunks.length > maxChunks) {
        let smallestIndex = 0;
        let smallestLength = Number.MAX_SAFE_INTEGER;

        for (let i = 0; i < chunks.length - 1; i++) {
            const merged = `${chunks[i]} ${chunks[i + 1]}`;
            if (merged.length < smallestLength) {
                smallestIndex = i;
                smallestLength = merged.length;
            }
        }

        if (smallestLength === Number.MAX_SAFE_INTEGER) {
            break;
        }

        chunks.splice(smallestIndex, 2, `${chunks[smallestIndex]} ${chunks[smallestIndex + 1]}`.trim());
    }

    return chunks.slice(0, maxChunks);
}

module.exports = { splitPdfTextIntoChunks };
