// build.mjs
//
// Conventions:
// - script.js      = main page JavaScript
// - _lazy-*.js     = lazy-loaded JavaScript
// - _*.css         = CSS partial, bundled via @import
// - other .css     = page stylesheet
// - csp.txt        = per-page CSP directives (one per line); merged into
//                    a single dist/_headers, not copied to the page itself
// - headers.txt    = site-wide headers (one "Name: value" per line), applied
//                    to /* in dist/_headers; only read at the src root
// - all asset URLs must be root-relative: /weather/script.js
// - everything else is copied unchanged
//
// Run:
//   node build.mjs

import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  rm,
  cp,
} from 'node:fs/promises';

import {
  join,
  extname,
  basename,
  dirname,
  relative,
  resolve,
} from 'node:path';

import { createHash } from 'node:crypto';
import {
  bundle as lightning,
  browserslistToTargets,
} from 'lightningcss';

import browserslist from 'browserslist';
import { minify as terser } from 'terser';


const SRC = resolve('src');
const OUT = resolve('dist');

const targets = browserslistToTargets(
  browserslist(),
);


// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const posix = path =>
  path.split('\\').join('/');

const hash = buffer =>
  createHash('sha256')
    .update(buffer)
    .digest('hex')
    .slice(0, 8);

const isMainJs = file =>
  extname(file) === '.js' &&
  basename(file) === 'script.js';

const isLazyJs = file =>
  extname(file) === '.js' &&
  basename(file).startsWith('_lazy-');

const isCssPartial = file =>
  extname(file) === '.css' &&
  basename(file).startsWith('_');

const isCsp = file =>
  basename(file) === 'csp.txt';

const isGlobalHeaders = file =>
  basename(file) === 'headers.txt' &&
  dirname(file) === SRC;


// Convert:
//
// /weather/script.js
//
// to:
//
// weather/script.js
//
// which matches the keys stored in `renamed`.
function assetKey(url) {
  if (!url.startsWith('/')) {
    throw new Error(
      `Asset path must start with "/": ${url}`,
    );
  }

  return posix(
    url.slice(1),
  );
}


// Convert a page directory (e.g. `<SRC>/weather`) into its Cloudflare
// Pages route, e.g. `/weather`. The site root becomes `/`.
function cspRoute(dir) {
  const rel = posix(
    relative(SRC, dir),
  );

  return rel === ''
    ? '/'
    : `/${rel}`;
}


async function walk(dir) {
  const files = [];

  const entries = await readdir(dir, {
    withFileTypes: true,
  });

  entries.sort(
    (a, b) => a.name.localeCompare(b.name),
  );

  for (const entry of entries) {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await walk(path));
    } else {
      files.push(path);
    }
  }

  return files;
}


async function minifyJs(source, rel) {
  const result = await terser(source, {
    module: true,
    compress: true,
    mangle: true,
  });

  if (result.code == null) {
    throw new Error(
      `Terser produced no output for ${rel}`,
    );
  }

  return Buffer.from(result.code);
}


// -----------------------------------------------------------------------------
// Hashed output
// -----------------------------------------------------------------------------

const renamed = new Map();

async function emitHashed(rel, output) {
  const outRel = rel.replace(
    /\.(css|js)$/,
    `.${hash(output)}.$1`,
  );

  renamed.set(
    posix(rel),
    posix(outRel),
  );

  const dest = join(
    OUT,
    outRel,
  );

  await mkdir(dirname(dest), {
    recursive: true,
  });

  await writeFile(
    dest,
    output,
  );
}


// -----------------------------------------------------------------------------
// Build
// -----------------------------------------------------------------------------

await rm(OUT, {
  recursive: true,
  force: true,
});

const files = await walk(SRC);
const unresolved = [];


// -----------------------------------------------------------------------------
// Pass 1 — lazy JavaScript
//
// Build these first because script.js may reference them.
// -----------------------------------------------------------------------------

for (const file of files) {
  if (!isLazyJs(file)) {
    continue;
  }

  const rel = relative(SRC, file);
  const source = await readFile(file, 'utf8');

  await emitHashed(
    rel,
    await minifyJs(source, rel),
  );
}


// -----------------------------------------------------------------------------
// Pass 2 — CSS + script.js
// -----------------------------------------------------------------------------

const LAZY_JS_REF =
  /(\.src\s*=\s*)(["'])(\/[^"'\r\n]*_lazy-[^"'\r\n]*\.js)\2/g;


for (const file of files) {
  const ext = extname(file);


  // CSS
  if (ext === '.css') {
    if (isCssPartial(file)) {
      continue;
    }

    const rel = relative(SRC, file);

    const output = lightning({
      filename: file,
      minify: true,
      targets,
    }).code;

    await emitHashed(
      rel,
      output,
    );

    continue;
  }


  // Main JS
  if (!isMainJs(file)) {
    continue;
  }

  const rel = relative(SRC, file);
  let source = await readFile(file, 'utf8');

  source = source.replace(
    LAZY_JS_REF,

    (match, prefix, quote, url) => {
      const hit = renamed.get(
        assetKey(url),
      );

      if (!hit) {
        unresolved.push(
          `${url} referenced by ${rel}`,
        );

        return match;
      }

      return (
        `${prefix}${quote}/${hit}${quote}`
      );
    },
  );

  await emitHashed(
    rel,
    await minifyJs(source, rel),
  );
}


// -----------------------------------------------------------------------------
// Pass 3 — HTML + static files
// -----------------------------------------------------------------------------

const HTML_ASSET_REF =
  /(href|src)=("|')(\/[^"']+\.(?:css|js))(?:[?#][^"']*)?\2/g;


for (const file of files) {
  const rel = relative(SRC, file);


  // Already handled, or handled separately below.
  if (
    extname(file) === '.css' ||
    isMainJs(file) ||
    isLazyJs(file) ||
    isCsp(file) ||
    isGlobalHeaders(file)
  ) {
    continue;
  }

  const dest = join(
    OUT,
    rel,
  );

  await mkdir(dirname(dest), {
    recursive: true,
  });


  // Everything except HTML is copied unchanged.
  if (extname(file) !== '.html') {
    await cp(
      file,
      dest,
    );

    continue;
  }


  // Rewrite CSS/JS references in HTML.
  const source = await readFile(
    file,
    'utf8',
  );

  const html = source.replace(
    HTML_ASSET_REF,

    (match, attr, quote, url) => {
      const hit = renamed.get(
        assetKey(url),
      );

      if (!hit) {
        unresolved.push(
          `${url} referenced by ${rel}`,
        );

        return match;
      }

      return (
        `${attr}=${quote}/${hit}${quote}`
      );
    },
  );

  await writeFile(
    dest,
    html,
  );
}


// -----------------------------------------------------------------------------
// Pass 4 — headers
//
// Merge the site-wide headers.txt (applied once, to /*) and every page's
// csp.txt into a single Cloudflare Pages `_headers` file.
// -----------------------------------------------------------------------------

const blocks = [];

const globalHeadersFile = files.find(isGlobalHeaders);

if (globalHeadersFile) {
  const source = await readFile(globalHeadersFile, 'utf8');

  const lines = source
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  blocks.push(
    [
      '/*',
      ...lines.map(line => `  ${line}`),
    ].join('\n'),
  );
}

const cspEntries = [];

for (const file of files) {
  if (!isCsp(file)) {
    continue;
  }

  const source = await readFile(file, 'utf8');

  const policy = source
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .join(' ');

  cspEntries.push({
    route: cspRoute(dirname(file)),
    policy,
  });
}

cspEntries.sort(
  (a, b) => a.route.localeCompare(b.route),
);

for (const { route, policy } of cspEntries) {
  const paths = route === '/'
    ? [route]
    : [route, `${route}/*`];

  blocks.push(
    paths
      .map(path => (
        `${path}\n  Content-Security-Policy: ${policy}`
      ))
      .join('\n'),
  );
}

if (blocks.length > 0) {
  await writeFile(
    join(OUT, '_headers'),
    `${blocks.join('\n\n')}\n`,
  );
}


// -----------------------------------------------------------------------------
// Validate
// -----------------------------------------------------------------------------

if (unresolved.length > 0) {
  throw new Error(
    [
      'Build failed: unresolved CSS/JS references:',
      '',
      ...unresolved.map(
        item => `  - ${item}`,
      ),
    ].join('\n'),
  );
}


console.log(
  `Built ${files.length} source files → dist/`,
);