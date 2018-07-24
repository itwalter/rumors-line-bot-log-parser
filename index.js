const fs = require('fs');
const readline = require('readline');
const crypto = require('crypto');

const csvStringify = require('csv-stringify');

if (!process.argv[2]) {
  console.info('Please provide input filename.');
  console.info('Usage: node index.js <input file>');
  process.exit(1);
}

const inputFilePath = process.argv[2];

const rl = readline.createInterface({
  input: fs.createReadStream(inputFilePath),
  crlfDelay: Infinity,
});

const conversations = [];

let buffer = '';
rl.on('line', line => {
  // 112 <190>1 2018-07-16T17:32:16.082803+00:00 app web.1 - - ||LOG||<----------
  if (!line.includes('||LOG||')) return;

  const [, timestamp, content] = line.match(
    /.+ (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{6}\+\d{2}:\d{2}) .+ \|\|LOG\|\|(.*)/
  );

  if (content === '<----------') {
    if (buffer !== '') {
      console.info(
        `[INFO] Incomplete message detected at ${timestamp}; ignoring`
      );
    }
    buffer = '';
    return;
  }

  if (content === '---------->') {
    let conversationObj;
    try {
      conversationObj = JSON.parse(buffer);
    } catch (e) {
      console.error(`[ERROR] Cannot parse message at ${timestamp}; skipping`);
      return;
    }

    conversationObj._logTimestamp = timestamp;

    conversations.push(conversationObj);

    buffer = '';
    return;
  }

  buffer += content;
});

rl.on('close', () => {
  fs.writeFileSync(
    `${inputFilePath}.out.json`,
    JSON.stringify(conversations, null, '  ')
  );

  const csvHeaders = [
    'timestamp',
    'userIdsha256',
    'input.message.text',
    'context.issuedAt',
    'context.data.searchedText',
    'context.state',
    'output.context.state',
    'output.replies',
  ];

  csvStringify(
    [
      csvHeaders,
      ...conversations.map(({ _logTimestamp, CONTEXT, INPUT, OUTPUT }) => {
        const issuedAt = new Date(CONTEXT.issuedAt);
        return [
          new Date(_logTimestamp).toISOString(),
          sha256(INPUT.userId),
          collapseLines(INPUT.message && INPUT.message.text),
          isNaN(+issuedAt) ? '' : issuedAt.toISOString(),
          collapseLines(CONTEXT.data && CONTEXT.data.searchedText),
          CONTEXT.state,
          OUTPUT.context.state,
          collapseLines(
            (OUTPUT.replies || [])
              .map(({ text, altText }) => text || altText)
              .join('↵')
          ),
        ];
      }),
    ],
    (err, output) => {
      if (err) {
        throw err;
      }
      fs.writeFileSync(`${inputFilePath}.out.csv`, output);
    }
  );
});

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
