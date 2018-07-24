# rumors-line-bot-log-parser
Parses the STDOUT logs emitted by rumors-line-bot

## Usage

```bash
$ node index.js <Input file>
```

It outputs `<Input file>.out.json` and `<Input file>.out.csv`.

## Input file

Should be a text file including something like:

```
112 <190>1 2018-07-16T17:37:36.459659+00:00 app web.1 - - ||LOG||<----------
(some content...)
112 <190>1 2018-07-16T17:37:36.465389+00:00 app web.1 - - ||LOG||---------->
```
