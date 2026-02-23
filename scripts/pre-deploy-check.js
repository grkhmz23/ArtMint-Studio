#!/usr/bin/env node
/**
 * ArtMint Studio - Pre-Deployment Checklist
 * 
 * This script verifies all critical configuration before mainnet deployment.
 * 
 * Usage:
 *   node scripts/pre-deploy-check.js
 */

const fs = require('fs');
const path = require('path');

// ANSI colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m';

let passed = 0;
let failed = 0;
let warnings = 0;

function pass(msg) {
  console.log(`${GREEN}✓${NC} ${msg}`);
  passed++;
}

function fail(msg, details) {
  console.log(`${RED}✗${NC} ${msg}`);
  if (details) console.log(`  ${details}`);
  failed++;
}

function warn(msg) {
  console.log(`${YELLOW}⚠${NC} ${msg}`);
  warnings++;
}

function section(title) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
}

console.log('='.repeat(50));
console.log('ArtMint Studio - Pre-Deployment Checklist');
console.log('='.repeat(50));

// Check 1: Environment Variables
section('1. Environment Variables');

const requiredVars = [
  'SOLANA_CLUSTER',
  'SOLANA_RPC_URL',
  'NEXT_PUBLIC_SOLANA_RPC_URL',
  'DATABASE_URL',
  'SESSION_SECRET',
  'AI_PROVIDER',
  'AI_API_KEY',
  'AI_MODEL',
  'NEXT_PUBLIC_APP_URL',
  'STORAGE_PROVIDER',
];

const recommendedVars = [
  'SOLANA_RPC_BACKUP_URL',
  'BLOB_READ_WRITE_TOKEN',
  'BLOB_ACCESS',
  'AI_MAX_DAILY_PER_USER',
  'AI_MAX_DAILY_GLOBAL',
];

const criticalVars = {
  'SOLANA_CLUSTER': (val) => val === 'mainnet-beta',
  'STORAGE_PROVIDER': (val) => val === 'vercel-blob',
  'SESSION_SECRET': (val) => val && val.length >= 32 && !val.includes('dev-secret') && !val.includes('CHANGE_THIS'),
  'SOLANA_RPC_URL': (val) => val && !val.includes('api.mainnet-beta.solana.com'),
};

for (const varName of requiredVars) {
  const value = process.env[varName];
  if (!value) {
    fail(`${varName} is not set`);
  } else {
    const validator = criticalVars[varName];
    if (validator) {
      if (validator(value)) {
        pass(`${varName} is correctly configured`);
      } else {
        fail(`${varName} has incorrect value`, `Current: ${value.slice(0, 20)}...`);
      }
    } else {
      pass(`${varName} is set`);
    }
  }
}

for (const varName of recommendedVars) {
  const value = process.env[varName];
  if (!value) {
    warn(`${varName} is not set (recommended)`);
  } else {
    pass(`${varName} is set`);
  }
}

// Check 2: Database Configuration
section('2. Database Configuration');

const dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) {
  fail('DATABASE_URL points to localhost', 'Use production PostgreSQL for mainnet');
} else if (dbUrl.includes('codespace')) {
  fail('DATABASE_URL uses Codespace database', 'Use production PostgreSQL for mainnet');
} else {
  pass('DATABASE_URL appears to be production database');
}

if (dbUrl.includes('sslmode=require') || dbUrl.includes('ssl=true')) {
  pass('Database SSL is enabled');
} else {
  warn('Database SSL not explicitly enabled');
}

// Check 3: RPC Configuration
section('3. RPC Configuration');

const rpcUrl = process.env.SOLANA_RPC_URL || '';
if (rpcUrl.includes('helius') || rpcUrl.includes('quicknode') || rpcUrl.includes('alchemy')) {
  pass('Using dedicated RPC provider');
} else if (rpcUrl.includes('api.mainnet-beta.solana.com')) {
  fail('Using public Solana RPC', 'Use Helius, QuickNode, or Alchemy for production');
} else if (rpcUrl.includes('devnet')) {
  fail('RPC URL points to devnet', 'Change to mainnet RPC for production');
} else {
  warn('RPC provider unknown - verify it supports mainnet');
}

// Check 4: Security Checks
section('4. Security Configuration');

const sessionSecret = process.env.SESSION_SECRET || '';
if (sessionSecret.length < 32) {
  fail('SESSION_SECRET is too short', 'Must be at least 32 characters');
} else if (sessionSecret.includes('dev') || sessionSecret.includes('test') || sessionSecret.includes('CHANGE')) {
  fail('SESSION_SECRET appears to be development value');
} else {
  pass('SESSION_SECRET looks secure');
}

// Check 5: File Structure
section('5. Project Structure');

const requiredFiles = [
  'prisma/schema.prisma',
  'prisma/migrations',
  'packages/exchangeart/src/constants.ts',
];

for (const file of requiredFiles) {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    pass(`${file} exists`);
  } else {
    fail(`${file} is missing`);
  }
}

// Check 6: Database Migrations
section('6. Database Migrations');

const migrationsDir = path.join(process.cwd(), 'prisma/migrations');
if (fs.existsSync(migrationsDir)) {
  const migrations = fs.readdirSync(migrationsDir).filter(f => 
    fs.statSync(path.join(migrationsDir, f)).isDirectory()
  );
  pass(`${migrations.length} migration(s) found`);
  
  // Check for performance indexes migration
  const hasIndexMigration = migrations.some(m => m.includes('performance') || m.includes('index'));
  if (hasIndexMigration) {
    pass('Performance indexes migration found');
  } else {
    warn('Performance indexes migration not found - run: pnpm db:migrate');
  }
} else {
  fail('Migrations directory not found');
}

// Check 7: Build Verification
section('7. Build Verification');

const buildDir = path.join(process.cwd(), 'apps/web/.next');
if (fs.existsSync(buildDir)) {
  pass('Build directory exists');
  
  // Check for critical files
  const requiredBuildFiles = [
    'BUILD_ID',
    'server/app/api/health',
  ];
  
  for (const file of requiredBuildFiles) {
    const filePath = path.join(buildDir, file);
    if (fs.existsSync(filePath)) {
      pass(`Build includes ${file}`);
    } else {
      warn(`Build may be missing ${file}`);
    }
  }
} else {
  fail('Build directory not found - run: pnpm build');
}

// Check 8: AI Configuration
section('8. AI Configuration');

const aiProvider = process.env.AI_PROVIDER;
const aiKey = process.env.AI_API_KEY;

if (aiProvider === 'anthropic' || aiProvider === 'openai') {
  pass(`AI provider is ${aiProvider}`);
} else {
  warn(`AI provider is ${aiProvider || 'not set'} (expected: anthropic or openai)`);
}

if (aiKey && aiKey.length > 20 && !aiKey.includes('your')) {
  pass('AI API key appears valid');
} else {
  fail('AI API key appears invalid or is placeholder');
}

// Summary
section('Summary');
console.log(`${GREEN}Passed: ${passed}${NC}`);
console.log(`${RED}Failed: ${failed}${NC}`);
console.log(`${YELLOW}Warnings: ${warnings}${NC}`);
console.log('');

if (failed === 0) {
  console.log(`${GREEN}✓ All critical checks passed!${NC}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Run smoke test: ./scripts/smoke-test.sh');
  console.log('  2. Deploy to Vercel: vercel --prod');
  console.log('  3. Verify: curl https://your-domain.com/api/health');
  process.exit(0);
} else {
  console.log(`${RED}✗ ${failed} critical check(s) failed${NC}`);
  console.log('');
  console.log('Please fix the issues above before deploying.');
  process.exit(1);
}
