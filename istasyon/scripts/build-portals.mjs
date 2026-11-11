// Builds optimized bundles for each portal and creates .zip archives with index.html at the root.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = join(rootDir, 'dist');

const PORTALS = ['crazygames', 'poki', 'gd', 'none'];

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

for (const portal of PORTALS) {
  console.log(`\n========================================`);
  console.log(`Building portal bundle: ${portal}`);
  console.log(`========================================\n`);

  const outDir = join(distDir, portal);
  const zipFile = join(distDir, `istasyon-${portal}.zip`);

  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }
  if (existsSync(zipFile)) {
    rmSync(zipFile, { force: true });
  }

  // Run vite build with VITE_PORTAL set
  const cmd = `npx vite build --outDir "dist/${portal}" --base ./`;
  execSync(cmd, {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_PORTAL: portal,
    },
  });

  // Create zip file with files at zip root using native tar.exe (-a automatically creates zip based on extension)
  console.log(`\nArchiving to dist/istasyon-${portal}.zip...`);
  const tarCmd = `tar.exe -a -c -f "${zipFile}" -C "${outDir}" .`;
  execSync(tarCmd, { cwd: rootDir, stdio: 'inherit' });

  if (existsSync(zipFile)) {
    console.log(`✓ Created istasyon-${portal}.zip`);
  } else {
    throw new Error(`Failed to create ${zipFile}`);
  }
}

console.log('\nAll portal builds complete and zipped!');
