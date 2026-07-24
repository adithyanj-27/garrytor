const fs = require('fs');
const path = require('path');

const srcIcon = 'C:\\Users\\adith\\.gemini\\antigravity\\brain\\0bb297ab-e81e-4304-b443-4e125c0a94c8\\garrytor_app_icon_1784363343282.png';
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
const publicDir = path.join(__dirname, '..', 'public');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

if (fs.existsSync(srcIcon)) {
  fs.copyFileSync(srcIcon, path.join(iconsDir, 'icon-192.png'));
  fs.copyFileSync(srcIcon, path.join(iconsDir, 'icon-512.png'));
  fs.copyFileSync(srcIcon, path.join(publicDir, 'favicon.png'));
  console.log('Successfully restored original app icon garrytor_app_icon_1784363343282.png to PWA icons!');
} else {
  console.error('Original app icon file not found at:', srcIcon);
}
