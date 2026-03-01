const esbuild = require('esbuild');
const path = require('path');

const isDev = process.argv.includes('--dev');

async function build() {
  const ctx = await esbuild.context({
    entryPoints: [path.join('wwwroot', 'app', 'react', 'index.tsx')],
    bundle: true,
    outfile: path.join('wwwroot', 'dist', 'app.js'),
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
