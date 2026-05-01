const fs = require('fs');

let data = fs.readFileSync('src/App.tsx', 'utf8');

const replacements = [
  [/(?<!dark:)bg-zinc-800/g, 'bg-slate-200 dark:bg-zinc-800'],
];

for (const [r, n] of replacements) {
    data = data.replace(r, n);
}

fs.writeFileSync('src/App.tsx', data);
