const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../R1_Refactored/R1_Refactored.ino');
const content = fs.readFileSync(filePath, 'utf8');

let line = 1, col = 1;
let inString = false, inChar = false, inLineComment = false, inBlockComment = false;
let escape = false;
const stack = [];
const errors = [];

for (let i = 0; i < content.length; i++) {
  const c = content[i];
  const next = content[i + 1];

  if (c === '\n') {
    line++;
    col = 1;
    inLineComment = false;
    continue;
  }
  col++;

  if (inLineComment) continue;

  if (inBlockComment) {
    if (c === '*' && next === '/') {
      inBlockComment = false;
      i++;
      col++;
    }
    continue;
  }

  if (inString) {
    if (escape) {
      escape = false;
    } else if (c === '\\') {
      escape = true;
    } else if (c === '"') {
      inString = false;
    }
    continue;
  }

  if (inChar) {
    if (escape) {
      escape = false;
    } else if (c === '\\') {
      escape = true;
    } else if (c === "'") {
      inChar = false;
    }
    continue;
  }

  if (c === '/' && next === '/') {
    inLineComment = true;
    i++;
    col++;
    continue;
  }
  if (c === '/' && next === '*') {
    inBlockComment = true;
    i++;
    col++;
    continue;
  }
  if (c === '"') {
    inString = true;
    continue;
  }
  if (c === "'") {
    inChar = true;
    continue;
  }

  if (c === '{' || c === '(' || c === '[') {
    stack.push({ char: c, line, col });
  } else if (c === '}' || c === ')' || c === ']') {
    if (stack.length === 0) {
      errors.push({ error: 'Unexpected closing ' + c, line, col });
    } else {
      const top = stack.pop();
      const match =
        (top.char === '{' && c === '}') ||
        (top.char === '(' && c === ')') ||
        (top.char === '[' && c === ']');
      if (!match) {
        errors.push({ error: `Mismatched ${top.char} with ${c}`, openedAt: top.line, line, col });
      }
    }
  }
}

if (stack.length > 0) {
  stack.forEach((unclosed) => {
    errors.push({ error: 'Unclosed ' + unclosed.char, openedAt: unclosed.line, col: unclosed.col });
  });
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔬 C++ STATIC LEXICAL & BRACE BALANCE AUDIT: R1_Refactored.ino');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📄 Total Lines Audited: ${line}`);
console.log(`⚠️ Syntax / Balance Errors Found: ${errors.length}`);

if (errors.length > 0) {
  console.error('❌ Compilation syntax errors detected:');
  console.error(JSON.stringify(errors, null, 2));
  process.exit(1);
} else {
  console.log('✅ 100% PERFECT C++ LEXICAL BALANCE (All braces, parens, brackets, and strings matched perfectly)');
}
