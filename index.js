const fs = require('fs');
const readline = require('readline');

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
    }

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
});
