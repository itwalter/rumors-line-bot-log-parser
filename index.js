const fs = require('fs');
const { Transform } = require('stream');
const readline = require('readline');
const crypto = require('crypto');

const csvStringify = require('csv-stringify');

if (!process.argv[2]) {
  console.info('Please provide input filename.');
  console.info('Usage: node index.js <input file>');
  process.exit(1);
}

const fileContentToLines = new Transform({
  transform(chunk, encoding, callback) {
    chunk.split(/\r\n|\r|\n/).forEach(line => {
      if (line) {
        this.push(line);
      }
    });

    callback();
  },
});

const lineToConversationObj = new Transform({
  readableObjectMode: true,
  transform(line, encoding, callback) {
    // Each chunk should be a line
    // 112 <190>1 2018-07-16T17:32:16.082803+00:00 app web.1 - - ||LOG||<----------
    if (!line.includes('||LOG||')) return callback();

    const [, timestamp, content] = line.match(
      /.*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{6}\+\d{2}:\d{2}) .+ \|\|LOG\|\|(.*)/
    );

    if (content === '<----------') {
      if (this._buffer !== '') {
        console.info(
          `[INFO] Incomplete message detected at ${timestamp}; ignoring`
        );
      }
      this._buffer = '';

      return callback();
    }

    if (content === '---------->') {
      let conversationObj;
      try {
        conversationObj = JSON.parse(this._buffer);
      } catch (e) {
        console.error(`[ERROR] Cannot parse message at ${timestamp}; skipping`);
        return callback();
      }

      const { CONTEXT, INPUT, OUTPUT } = conversationObj;
      const issuedAt = new Date(CONTEXT.issuedAt);

      this.push({
        timestamp: new Date(timestamp).toISOString(),
        userIdsha256: sha256(INPUT.userId),
        'input.message.text': collapseLines(
          INPUT.message && INPUT.message.text
        ),
        'context.issuedAt': isNaN(+issuedAt) ? '' : issuedAt.toISOString(),
        'context.data.searchedText': collapseLines(
          CONTEXT.data && CONTEXT.data.searchedText
        ),
        'context.state': CONTEXT.state,
        'output.context.state': OUTPUT.context.state,
        'output.replies': collapseLines(
          (OUTPUT.replies || [])
            .map(({ text, altText }) => text || altText)
            .join('↵')
        ),
      });

      this._buffer = '';
      return callback();
    }

    this._buffer += content;
    callback();
  },
});

const inputFilePath = process.argv[2];

fs.createReadStream(inputFilePath)
  .pipe(fileContentToLines)
  .pipe(lineToConversationObj)
  .pipe(
    csvStringify({
      header: true,
      columns: [
        'timestamp',
        'userIdsha256',
        'input.message.text',
        'context.issuedAt',
        'context.data.searchedText',
        'context.state',
        'output.context.state',
        'output.replies',
      ],
    })
  )
  .pipe(fs.writeFile(`${inputFilePath}.out.csv`));

/**
 * @param {string} input
 * @returns {string} - input's sha256 hash hex string. Empty string if input is falsy.
 */
function sha256(input) {
  return input
    ? crypto
        .createHash('sha256')
        .update(input, 'utf8')
        .digest('hex')
    : '';
}

/**
 * @param {string} str
 * @returns {string} input string with all line breaks being replaced by return symbol
 */
function collapseLines(str) {
  return (str || '').replace(/\r|\n/gm, '↵');
}
