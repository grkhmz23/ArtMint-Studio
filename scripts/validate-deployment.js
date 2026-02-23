#!/usr/bin/env node
/**
 * Pre-Deployment Validation Script
 * 
 * Run this before deploying to mainnet to catch common issues.
 * Usage: node scripts/validate-deployment.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let exitCode = 0;

function log(level, message) {
  const color = level === 'ERROR' ? RED : level === 'WARN' ? YELLOW : GREEN;
  console.log(`${color}[${level}]${RESET} ${message}`);
}

function check(condition, successMsg, errorMsg) {
  if (condition) {
    log('OK', successMsg);
    return true;
  } else {
    log('ERROR', errorMsg);
    exitCode = 1;
    return false;
  }
}

console.log('\n🏗️  ArtMint Studio - Pre-Deployment Validation\n');
console.log('=' .repeat(50));

// 1. Check Node.js version
console.log('\n📦 Environment Checks');
console.log('-'.repeat(30));

try {
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split('.')[0]);
  check(major >= 18, `Node.js version: ${nodeVersion}`, `Node.js ${nodeVersion} < 18, upgrade required`);
} catch (e) {
  log('ERROR', 'Could not check Node.js version');
}

// 2. Check pnpm
let hasPnpm = false;
try {
  const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8' }).trim();
  hasPnpm = true;
  log('OK', `pnpm installed: ${pnpmVersion}`);
} catch (e) {
  log('ERROR', 'pnpm not found. Install with: npm install -g pnpm');
}

// 3. Check environment variables
console.log('\n🔐 Environment Variables');
console.log('-'.repeat(30));

const envPath = path.join(__dirname, '..', 'apps', 'web', '.env.local');
const envExamplePath = path.join(__dirname, '..', '.env.example');

if (!fs.existsSync(envPath)) {
  log('WARN', `.env.local not found at ${envPath}`);
  log('INFO', 'Copy .env.example to .env.local and configure');
} else {
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Check critical variables
  const criticalVars = [
    'SESSION_SECRET',
    'SOLANA_CLUSTER',
    'SOLANA_RPC_URL',
    'DATABASE_URL',
    'AI_API_KEY',
  ];
  
  for (const variable of criticalVars) {
    const hasVar = envContent.includes(`${variable}=`) && 
                   !envContent.includes(`${variable}=your-`) &&
                   !envContent.includes(`${variable}=YOUR_`);
    check(hasVar, `${variable} is configured`, `${variable} is missing or using placeholder`);
  }
  
  // Check mainnet configuration
  const isMainnet = envContent.includes('SOLANA_CLUSTER=mainnet-beta');
  if (isMainnet) {
    log('WARN', 'SOLANA_CLUSTER is set to mainnet-beta - ensure this is intentional');
  }
  
  // Check SESSION_SECRET is not default
  const hasDefaultSecret = envContent.includes('SESSION_SECRET=your-64-character') ||
                           envContent.includes('SESSION_SECRET=dev-secret');
  check(!hasDefaultSecret, 'SESSION_SECRET is not default', 'SESSION_SECRET appears to be using default/development value');
  
  // Check RPC URL is not public endpoint for mainnet
  const hasPublicRpc = envContent.includes('api.mainnet-beta.solana.com') ||
                       envContent.includes('solana-mainnet.g.alchemy.com/v1/YOUR');
  check(!hasPublicRpc, 'Using dedicated RPC provider', 'Using public/placeholder RPC endpoint');
}

// 4. Check Prisma schema
console.log('\n🗄️  Database Checks');
console.log('-'.repeat(30));

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  // Check required models exist
  const requiredModels = ['Mint', 'Listing', 'Session', 'Auction', 'Notification'];
  for (const model of requiredModels) {
    check(schema.includes(`model ${model}`), `Model ${model} exists`, `Model ${model} not found in schema`);
  }
  
  // Check for indexes on critical fields
  check(schema.includes('@@index([wallet])'), 'Index on Mint.wallet', 'Missing index on Mint.wallet');
  check(schema.includes('@@index([status])'), 'Index on Mint.status', 'Missing index on Mint.status');
} else {
  log('ERROR', 'Prisma schema not found');
}

// 5. TypeScript compilation
console.log('\n🔨 Build Checks');
console.log('-'.repeat(30));

try {
  execSync('cd apps/web && npx tsc --noEmit', { stdio: 'pipe' });
  log('OK', 'TypeScript compilation successful');
} catch (e) {
  log('ERROR', 'TypeScript compilation failed - run "pnpm build" to see errors');
  exitCode = 1;
}

// 6. Check for console.logs in production code
console.log('\n🔍 Code Quality Checks');
console.log('-'.repeat(30));

try {
  const srcPath = path.join(__dirname, '..', 'apps', 'web', 'src');
  const files = execSync(`grep -r "console.log" ${srcPath} --include="*.ts" --include="*.tsx" -l`, 
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim().split('\n').filter(Boolean);
  
  if (files.length > 0) {
    log('WARN', `${files.length} files contain console.log statements:`);
    files.slice(0, 5).forEach(f => console.log(`  - ${f}`));
    if (files.length > 5) console.log(`  ... and ${files.length - 5} more`);
  } else {
    log('OK', 'No console.log statements found');
  }
} catch (e) {
  log('OK', 'No console.log statements found');
}

// 7. Check package.json scripts
console.log('\n📜 Package Configuration');
console.log('-'.repeat(30));

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

check(pkg.scripts['db:migrate'], 'db:migrate script exists', 'Missing db:migrate script');
check(pkg.scripts.build, 'build script exists', 'Missing build script');

// 8. Check for SECURITY.md
check(fs.existsSync(path.join(__dirname, '..', 'SECURITY.md')), 
  'SECURITY.md exists', 
  'SECURITY.md not found - document security procedures');

// 9. Check file sizes (warn on large bundles)
console.log('\n📊 Bundle Size Checks');
console.log('-'.repeat(30));

const pagesDir = path.join(__dirname, '..', 'apps', 'web', 'src', 'app');
if (fs.existsSync(pagesDir)) {
  const pageFiles = execSync(`find ${pagesDir} -name "page.tsx" -o -name "page.ts"`, 
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim().split('\n').filter(Boolean);
  
  log('INFO', `${pageFiles.length} pages found`);
  
  // Check for large pages
  for (const file of pageFiles.slice(0, 5)) {
    const stats = fs.statSync(file);
    const sizeKB = (stats.size / 1024).toFixed(1);
    if (stats.size > 50 * 1024) {
      log('WARN', `${path.basename(path.dirname(file))}/page.tsx: ${sizeKB}KB (consider code splitting)`);
    }
  }
}

// Summary
console.log('\n' + '='.repeat(50));
if (exitCode === 0) {
  console.log(GREEN + '\n✅ All checks passed! Ready for deployment.' + RESET);
  console.log('\nNext steps:');
  console.log('  1. Run: pnpm build');
  console.log('  2. Run: pnpm db:migrate');
  console.log('  3. Deploy to Vercel');
  console.log('  4. Run mainnet tests from MAINNET_TESTING_CHECKLIST.md');
} else {
  console.log(RED + '\n❌ Some checks failed. Fix issues before deploying.' + RESET);
}

process.exit(exitCode);
