const esbuild = require('esbuild');
const path = require('path');

const isWatch = process.argv.includes('--watch');
const isDev = isWatch || process.argv.includes('--dev');

const baseOptions = {
  entryPoints: [path.join(__dirname, 'src/widget.js')],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  define: {
    'process.env.NODE_ENV': isDev ? '"development"' : '"production"'
  }
};

const productionBuild = {
  ...baseOptions,
  outfile: path.join(__dirname, 'dist/widget.js'),
  minify: true,
  sourcemap: false
};

const devBuild = {
  ...baseOptions,
  outfile: path.join(__dirname, 'dist/widget.dev.js'),
  minify: false,
  sourcemap: 'inline'
};

if (isWatch) {
  esbuild.context(devBuild).then((ctx) => {
    ctx.watch();
    console.log('Watching dev build at', devBuild.outfile);
  });
} else {
  Promise.all([
    esbuild.build(productionBuild),
    esbuild.build(devBuild)
  ]).then(() => {
    console.log('Built:');
    console.log('  ' + productionBuild.outfile);
    console.log('  ' + devBuild.outfile);
  });
}
