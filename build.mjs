// build.mjs — minify + content-hash CSS/JS, mirror src/ structure into dist/
// Run: node build.mjs

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
import { bundle as lightning, browserslistToTargets } from 'lightningcss';
import browserslist from 'browserslist';
import { minify as terser } from 'terser';

const SRC = resolve('src');
const OUT = resolve('dist');

// Public path the site is served from.
//
// '/'         → domain root
// '/my-repo/' → GitHub Pages project site
//
// Must end with '/'.
const BASE = (process.env.BASE ?? '/').replace(/\/*$/, '/');

const targets = browserslistToTargets(browserslist());

const posix = path => path.split('\\').join('/');

const hash = buffer =>
  createHash('sha256')
    .update(buffer)
    .digest('hex')
    .slice(0, 8);


// -----------------------------------------------------------------------------
// Walk source tree
// -----------------------------------------------------------------------------

async function walk(dir) {
  const output = [];

  const entries = await readdir(dir, {
    withFileTypes: true,
  });

  // Deterministic builds across filesystems/platforms.
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      output.push(...await walk(path));
    } else {
      output.push(path);
    }
  }

  return output;
}


// -----------------------------------------------------------------------------
// Clean output
// -----------------------------------------------------------------------------

await rm(OUT, {
  recursive: true,
  force: true,
});

const files = await walk(SRC);

// src-relative path → hashed dist-relative path
//
// "todo/app.js"
//   →
// "todo/app.1a2b3c4d.js"
const renamed = new Map();


// -----------------------------------------------------------------------------
// Pass 1
//
// Minify CSS and JS and emit content-hashed files.
// -----------------------------------------------------------------------------

for (const file of files) {
  const ext = extname(file);

  if (ext !== '.css' && ext !== '.js') {
    continue;
  }

  const rel = relative(SRC, file);

  // CSS files prefixed with "_" are partials.
  // Lightning CSS pulls these into the page stylesheet via @import,
  // so they should not be emitted independently.
  if (
    ext === '.css' &&
    basename(file).startsWith('_')
  ) {
    continue;
  }

  let output;

  if (ext === '.css') {
    output = lightning({
      filename: file,
      minify: true,
      targets,
    }).code;
  }

  if (ext === '.js') {
    const source = await readFile(file, 'utf8');

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

    output = Buffer.from(result.code);
  }

  const outRel = rel.replace(
    /\.(css|js)$/,
    `.${hash(output)}.$1`,
  );

  renamed.set(
    posix(rel),
    posix(outRel),
  );

  const dest = join(OUT, outRel);

  await mkdir(dirname(dest), {
    recursive: true,
  });

  await writeFile(dest, output);
}


// -----------------------------------------------------------------------------
// Pass 2
//
// Copy everything else.
// Rewrite local CSS/JS references in HTML to their hashed filenames.
// -----------------------------------------------------------------------------

const unresolved = [];

for (const file of files) {
  const rel = relative(SRC, file);

  // Already emitted during Pass 1.
  if (/\.(css|js)$/.test(rel)) {
    continue;
  }

  const dest = join(OUT, rel);

  await mkdir(dirname(dest), {
    recursive: true,
  });

  // Non-HTML assets are copied unchanged.
  if (extname(file) !== '.html') {
    await cp(file, dest);
    continue;
  }

  const source = await readFile(file, 'utf8');

  const html = source.replace(
    /(href|src)=("|')([^"']+\.(?:css|js))(?:[?#][^"']*)?\2/g,
    (match, attr, quote, url) => {

      // Leave absolute/CDN URLs untouched.
      if (/^(?:https?:)?\/\//.test(url)) {
        return match;
      }

      // Resolve the URL relative to the HTML file,
      // then convert it to a src-relative lookup key.
      const key = posix(
        relative(
          SRC,
          resolve(dirname(file), url),
        ),
      );

      const hit = renamed.get(key);

      if (!hit) {
        unresolved.push(
          `${url} referenced by ${rel}`,
        );

        return match;
      }

      return `${attr}=${quote}${BASE}${hit}${quote}`;
    },
  );

  await writeFile(dest, html);
}


// -----------------------------------------------------------------------------
// Validate references
// -----------------------------------------------------------------------------

if (unresolved.length > 0) {
  throw new Error(
    [
      'Build failed: unresolved CSS/JS references:',
      '',
      ...unresolved.map(item => `  - ${item}`),
    ].join('\n'),
  );
}


// -----------------------------------------------------------------------------
// Optional build manifest
// -----------------------------------------------------------------------------

const manifest = Object.fromEntries(
  [...renamed.entries()].sort(
    ([a], [b]) => a.localeCompare(b),
  ),
);

await writeFile(
  join(OUT, 'manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);


// -----------------------------------------------------------------------------
// Done
// -----------------------------------------------------------------------------

console.log(
  `Built ${files.length} source files → dist/`,
);