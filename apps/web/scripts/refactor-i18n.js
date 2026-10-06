#!/usr/bin/env node
/**
 * Automated i18n Refactoring Script
 * Replaces hardcoded Arabic strings with t() calls
 * Run: node scripts/refactor-i18n.js
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Load dictionaries to build mapping
const arDict = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/locales/ar/common.json'), 'utf8'));
const enDict = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/locales/en/common.json'), 'utf8'));

// Build reverse mapping: Arabic text -> translation key
const arToKey = {};
for (const [key, value] of Object.entries(arDict)) {
  arToKey[value] = key;
}

// Common patterns to replace
const replacements = [
  // Navigation & Common UI
  { ar: 'الرئيسية', key: 'home' },
  { ar: 'الأجهزة', key: 'devices' },
  { ar: 'الغرف', key: 'rooms' },
  { ar: 'المشاهد', key: 'scenes' },
  { ar: 'الإعدادات', key: 'settings' },
  { ar: 'المساعد', key: 'assistant' },
  { ar: 'جميع الأجهزة', key: 'all_devices' },
  { ar: 'الأجهزة النشطة', key: 'active_devices' },
  
  // Actions
  { ar: 'تشغيل', key: 'turn_on' },
  { ar: 'إطفاء', key: 'turn_off' },
  { ar: 'إطفاء جميع الأجهزة', key: 'turn_off_all' },
  { ar: 'حفظ', key: 'save' },
  { ar: 'إلغاء', key: 'cancel' },
  { ar: 'حذف', key: 'delete' },
  { ar: 'تعديل', key: 'edit' },
  { ar: 'إضافة', key: 'add' },
  
  // Messages
  { ar: 'تم الحفظ بنجاح', key: 'save_success' },
  { ar: 'تم الحذف بنجاح', key: 'delete_success' },
  { ar: 'حدث خطأ', key: 'error_occurred' },
  { ar: 'جاري التحميل', key: 'loading' },
  
  // Rooms
  { ar: 'الصالة الرئيسية', key: 'main_living_room' },
  { ar: 'غرفة النوم الرئيسية', key: 'master_bedroom' },
  { ar: 'المطبخ', key: 'kitchen' },
  { ar: 'الاستقبال', key: 'guest_room' },
  { ar: 'الحمام', key: 'bathroom' },
  { ar: 'الحديقة', key: 'garden' },
  
  // Status
  { ar: 'متصل', key: 'connected' },
  { ar: 'غير متصل', key: 'disconnected' },
  { ar: 'متصل بالشبكة', key: 'online' },
  
  // Confirmations
  { ar: 'هل أنت متأكد من الحذف؟', key: 'confirm_delete' },
  { ar: 'هل أنت متأكد من رغبتك بإطفاء جميع الأجهزة', key: 'confirm_turn_off_all' },
];

function refactorFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Check if file already imports useTranslation
  const hasTranslationImport = content.includes('useTranslation');
  const hasTranslationHook = content.match(/const\s+{\s*t\s*[,}]/);
  
  // If it uses isEn pattern, it likely needs refactoring
  const usesIsEn = content.includes('isEn ? ') || content.includes('lang === \'en\'');
  
  if (!usesIsEn && !content.includes('الأجهزة') && !content.includes('الإعدادات')) {
    return false; // No Arabic strings, skip
  }
  
  // Add import if missing
  if (!hasTranslationImport) {
    const importMatch = content.match(/(import.*from ['"]react['"];?\n)/);
    if (importMatch) {
      content = content.replace(
        importMatch[0],
        importMatch[0] + "import { useTranslation } from '@/hooks/useTranslation';\n"
      );
      modified = true;
    }
  }
  
  // Add hook call if missing
  if (!hasTranslationHook && usesIsEn) {
    const componentMatch = content.match(/(export default function \w+\([^)]*\)\s*{)/);
    if (componentMatch) {
      const hookLine = componentMatch[0] + '\n  const { t, isEn } = useTranslation();';
      content = content.replace(componentMatch[0], hookLine);
      modified = true;
    }
  }
  
  // Replace hardcoded Arabic strings with t() calls
  for (const { ar, key } of replacements) {
    const patterns = [
      // String literals in JSX
      new RegExp(`>\\s*${ar}\\s*<`, 'g'),
      // String literals in attributes
      new RegExp(`["']${ar}["']`, 'g'),
      // Template literals
      new RegExp(`\`${ar}\``, 'g'),
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        content = content.replace(pattern, (match) => {
          if (match.startsWith('>')) {
            return `>{t('${key}')}<`;
          } else if (match.startsWith('"') || match.startsWith("'")) {
            return `{t('${key}')}`;
          } else {
            return `{t('${key}')}`;
          }
        });
        modified = true;
      }
    }
  }
  
  // Replace ternary patterns: isEn ? 'English' : 'Arabic'
  const ternaryPattern = /isEn\s*\?\s*['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
  content = content.replace(ternaryPattern, (match, enText, arText) => {
    const key = arToKey[arText];
    if (key) {
      modified = true;
      return `t('${key}')`;
    }
    return match;
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Refactored: ${path.relative(process.cwd(), filePath)}`);
    return true;
  }
  
  return false;
}

// Main execution
const componentsDir = path.join(__dirname, '../src');
const files = glob.sync(`${componentsDir}/**/*.{tsx,ts}`, {
  ignore: ['**/node_modules/**', '**/*.test.*', '**/hooks/useTranslation.ts']
});

let refactoredCount = 0;
console.log(`Found ${files.length} files to process...\n`);

for (const file of files) {
  if (refactorFile(file)) {
    refactoredCount++;
  }
}

console.log(`\n✅ Complete! Refactored ${refactoredCount} files.`);
console.log(`\nNext steps:`);
console.log(`1. Test the app: npm run dev`);
console.log(`2. Switch language and verify all text translates`);
console.log(`3. Check for any missed strings and add them to dictionaries`);
