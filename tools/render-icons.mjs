import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

function render(svgPath, outPath, width) {
  const svg = readFileSync(svgPath, 'utf8');
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: width } });
  const png = resvg.render().asPng();
  writeFileSync(outPath, png);
  console.log('wrote', outPath, png.length, 'bytes');
}

mkdirSync('assets/images', { recursive: true });
render('tools/icon.svg', 'assets/images/icon.png', 1024);
render('tools/icon-foreground.svg', 'assets/images/android-icon-foreground.png', 1024);
render('tools/icon-monochrome.svg', 'assets/images/android-icon-monochrome.png', 1024);
render('tools/icon-foreground.svg', 'assets/images/splash-icon.png', 240);
render('tools/icon-foreground.svg', 'assets/images/favicon.png', 64);
