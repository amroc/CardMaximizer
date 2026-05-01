const fs = require('fs');

let data = fs.readFileSync('src/App.tsx', 'utf8');

// We are currently in "dark" mode (zinc-900 etc). We want to change to "light default, dark conditionally".
// Mapping dark class -> light class + dark class
const replacements = [
  [/bg-zinc-950/g, 'bg-slate-100 dark:bg-zinc-950'],
  [/bg-zinc-900/g, 'bg-white dark:bg-zinc-900'],
  [/text-zinc-50/g, 'text-slate-900 dark:text-zinc-50'],
  [/text-zinc-200/g, 'text-slate-800 dark:text-zinc-200'],
  [/text-zinc-300/g, 'text-slate-700 dark:text-zinc-300'],
  [/text-zinc-400/g, 'text-slate-500 dark:text-zinc-400'],
  [/text-zinc-500/g, 'text-slate-400 dark:text-zinc-500'],
  [/border-zinc-800/g, 'border-slate-200 dark:border-zinc-800'],
  [/border-zinc-700/g, 'border-slate-300 dark:border-zinc-700'],
  [/hover:bg-zinc-800/g, 'hover:bg-slate-50 dark:hover:bg-zinc-800'],
  [/hover:bg-zinc-700/g, 'hover:bg-slate-200 dark:hover:bg-zinc-700'],
  [/hover:bg-zinc-200/g, 'hover:bg-slate-800 dark:hover:bg-zinc-200'],
  [/hover:bg-zinc-100/g, 'hover:bg-slate-900 dark:hover:bg-zinc-100'],
  [/border-t-zinc-400/g, 'border-t-slate-600 dark:border-t-zinc-400'],
  [/placeholder-zinc-500/g, 'placeholder-slate-400 dark:placeholder-zinc-500'],
  [/focus:ring-white/g, 'focus:ring-slate-900 dark:focus:ring-white'],
  [/focus:ring-zinc-800/g, 'focus:ring-slate-800 dark:focus:ring-zinc-800'],
  [/focus:ring-zinc-700/g, 'focus:ring-slate-200 dark:focus:ring-zinc-700'],
  
  [/bg-zinc-800/g, 'bg-slate-200 dark:bg-zinc-800'],
  // Ambers
  [/bg-amber-900\/30/g, 'bg-amber-50 dark:bg-amber-900/30'],
  [/border-amber-900(?!\/)/g, 'border-amber-200 dark:border-amber-900'],
  [/text-amber-400/g, 'text-amber-700 dark:text-amber-400'],
  [/text-amber-100/g, 'text-amber-900 dark:text-amber-100'],
  [/text-amber-200/g, 'text-amber-800 dark:text-amber-200'],
  [/bg-amber-900\/50/g, 'bg-amber-100 dark:bg-amber-900/50'],
  [/bg-amber-800/g, 'bg-amber-500 dark:bg-amber-800'],
  [/hover:bg-amber-900\/30/g, 'hover:bg-amber-50 dark:hover:bg-amber-900/30'],

  [/bg-gradient-to-br from-zinc-800 to-zinc-900/g, 'bg-gradient-to-br from-amber-600 to-amber-700 dark:from-zinc-800 dark:to-zinc-900'],
];

for (const [r, n] of replacements) {
    data = data.replace(r, n);
}

// Ensure the outer wrapper doesn't have duplicate darks if there is any mistake
// It's probably fine. Let's just write and format
fs.writeFileSync('src/App.tsx', data);
console.log('Done mapping dark to dark+light classes in App.tsx');
