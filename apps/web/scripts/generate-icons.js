const fs = require('fs')
const path = require('path')

const iconsDir = path.join(__dirname, '../public')
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true })
}

const icon192 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

fs.writeFileSync(path.join(iconsDir, 'icon-192x192.png'), icon192)
fs.writeFileSync(path.join(iconsDir, 'icon-512x512.png'), icon192)
console.log('Icons created')
