const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const isDev = process.argv.includes('--dev');

// Copy TinyMCE static assets (skins, themes, icons, models) to wwwroot/dist/tinymce
function copyTinymceAssets() {
  const src = path.join('node_modules', 'tinymce');
  const dest = path.join('wwwroot', 'dist', 'tinymce');
  const dirs = ['skins', 'themes', 'icons', 'models'];

  fs.mkdirSync(dest, { recursive: true });
  // Copy tinymce core JS files
  for (const file of ['tinymce.min.js', 'tinymce.js']) {
    const srcFile = path.join(src, file);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, path.join(dest, file));
    }
  }
  // Copy plugin/skin/theme/icon/model directories
  for (const dir of [...dirs, 'plugins']) {
    const srcDir = path.join(src, dir);
    const destDir = path.join(dest, dir);
    if (fs.existsSync(srcDir)) {
      fs.cpSync(srcDir, destDir, { recursive: true });
    }
  }
  console.log('TinyMCE assets copied.');
}

async function build() {
  const ctx = await esbuild.context({
    entryPoints: [path.join('wwwroot', 'app', 'react', 'index.tsx')],
    bundle: true,
    outdir: path.join('wwwroot', 'dist'),
    entryNames: 'app',
    minify: !isDev,
    sourcemap: isDev,
    target: 'es2021',
    loader: {
      '.tsx': 'tsx',
      '.ts': 'ts',
    },
    define: {
      'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
    },
  });

  copyTinymceAssets();

  if (isDev) {
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log('Build complete.');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
