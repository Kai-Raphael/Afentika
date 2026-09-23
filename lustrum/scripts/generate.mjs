#!/usr/bin/env node
/**
 * Genereert alles wat je voor het lustrumspel moet uploaden en printen.
 *
 *   npm run lustrum:generate                 # gebruikt lustrum/content/game.json
 *   npm run lustrum:generate -- --skip-todo  # sla vragen met TODO-antwoorden over
 *   npm run lustrum:generate -- --content lustrum/content/game.example.json
 *
 * Output in lustrum/out/ (gitignored):
 *   assignments.json  codes, pincodes, rollen en opdrachten; blijft stabiel tussen runs
 *   seed.sql          spelers en vragen voor D1
 *   stickers.html     QR-code + pincode per vraag, om te printen
 *   brieven.html      één brief per speler, om te printen
 *   spelleider.html   spiekbrief met alle antwoorden, codes en pincodes
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import QRCode from 'qrcode';
import { assign, buildSeedSql, questionUrl, validateContent } from './game-builder.js';

const OUT_DIR = new URL('../out/', import.meta.url);
const ASSIGNMENTS = new URL('assignments.json', OUT_DIR);

const { values: args } = parseArgs({
  options: {
    content: { type: 'string', default: 'lustrum/content/game.json' },
    'skip-todo': { type: 'boolean', default: false },
  },
});

const content = JSON.parse(readFileSync(args.content, 'utf8'));
const { errors, questions } = validateContent(content, { skipTodo: args['skip-todo'] });
if (errors.length) {
  console.error(`Content bevat fouten:\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
const previous = existsSync(ASSIGNMENTS) ? JSON.parse(readFileSync(ASSIGNMENTS, 'utf8')) : undefined;
const assignments = assign(content, questions, previous);
const sortedQuestions = [...questions].sort(
  (a, b) => assignments.questions[a.key].number - assignments.questions[b.key].number,
);

write('assignments.json', `${JSON.stringify(assignments, null, 2)}\n`);
write('seed.sql', buildSeedSql(content, sortedQuestions, assignments));
write('stickers.html', await renderStickers());
write('brieven.html', renderLetters());
write('spelleider.html', renderCheatSheet());

const skipped = content.questions.length - questions.length;
console.log(`Klaar: ${content.players.length} spelers, ${questions.length} vragen${skipped ? ` (${skipped} overgeslagen wegens TODO)` : ''}.`);
console.log('Upload met: npx wrangler d1 execute afentika-db --remote --file=lustrum/out/seed.sql');

function write(name, data) {
  writeFileSync(new URL(name, OUT_DIR), data);
  console.log(`  lustrum/out/${name}`);
}

async function renderStickers() {
  const stickers = await Promise.all(
    sortedQuestions.map(async (question) => {
      const { number, slug, pin } = assignments.questions[question.key];
      const qr = await QRCode.toString(questionUrl(content, slug), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
      return `<div class="sticker">${qr}<div class="pin">PIN ${pin}</div><div class="nr">#${number}</div></div>`;
    }),
  );
  return page(
    'Stickers',
    `.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6mm}
     .sticker{border:1px dashed #999;padding:3mm;text-align:center;break-inside:avoid}
     .sticker svg{width:100%;height:auto}
     .pin{font:700 16pt monospace;letter-spacing:.1em}
     .nr{font-size:8pt;color:#666}`,
    `<div class="grid">${stickers.join('')}</div>`,
  );
}

function renderLetters() {
  const roles = new Map(content.roles.map((role) => [role.name, role.description ?? '']));
  const letters = content.players.map((name) => {
    const { code, role, mission } = assignments.players[name];
    return `<section class="letter">
      <p class="kicker">${escape(content.gameTitle ?? 'Lustrum')} · Strikt persoonlijk</p>
      <h1>Beste ${escape(name)},</h1>
      <p>Welkom in huize Afentiká. Dit weekend ben jij:</p>
      <h2>${escape(role)}</h2>
      <p>${escape(roles.get(role) ?? '')}</p>
      <h3>Jouw geheime opdracht</h3>
      <p class="mission">${escape(mission)}</p>
      <p>Voer je opdracht uit zonder dat iemand het doorheeft. Lukt het? Meld het bij de spelleider voor bonuspunten.
         Maar pas op: bij de raadronde om 22:00 kunnen anderen punten verdienen door jouw opdracht te raden.</p>
      <h3>Jouw spelerscode</h3>
      <p class="code">${escape(code)}</p>
      <p>Door het huis hangen QR-stickers met een pincode. Scan ze, log in met je spelerscode en beantwoord de vraag.
         Je stand en de stemrondes vind je op <strong>${escape(content.baseUrl.replace(/^https:\/\//, ''))}/lustrum</strong>.
         Deel je code met niemand: wie hem heeft, speelt als jou.</p>
    </section>`;
  });
  return page(
    'Brieven',
    `.letter{page-break-after:always;max-width:150mm;margin:0 auto;padding:20mm 0;line-height:1.5}
     .kicker{text-transform:uppercase;letter-spacing:.15em;font-size:9pt;color:#00843D}
     h2{color:#00843D;font-size:22pt;margin:.2em 0}
     .mission{font-size:13pt;font-style:italic;border-left:3px solid #F5A623;padding-left:4mm}
     .code{font:700 24pt monospace;letter-spacing:.2em}`,
    letters.join(''),
  );
}

function renderCheatSheet() {
  const questionRows = sortedQuestions.map((question) => {
    const { number, slug, pin, anagram } = assignments.questions[question.key];
    return `<tr><td>${number}</td><td>${escape(question.title)}${anagram ? `<br><small>${escape(anagram)}</small>` : ''}</td>
      <td>${escape(question.answers.join(' / '))}</td><td>${question.points}</td><td>${pin}</td>
      <td>${escape(question.location ?? '')}</td><td><small>${escape(questionUrl(content, slug))}</small></td></tr>`;
  });
  const playerRows = content.players.map((name) => {
    const { code, role, mission } = assignments.players[name];
    return `<tr><td>${escape(name)}</td><td>${code}</td><td>${escape(role)}</td><td>${escape(mission)}</td></tr>`;
  });
  return page(
    'Spelleider',
    `table{border-collapse:collapse;width:100%;font-size:9pt;margin-bottom:10mm}
     td,th{border:1px solid #ccc;padding:2mm;text-align:left;vertical-align:top}`,
    `<h1>Spelleider: niet laten slingeren</h1>
     <h2>Vragen</h2><table><tr><th>#</th><th>Vraag</th><th>Antwoorden</th><th>Pnt</th><th>PIN</th><th>Plek</th><th>URL</th></tr>${questionRows.join('')}</table>
     <h2>Spelers</h2><table><tr><th>Naam</th><th>Code</th><th>Rol</th><th>Opdracht</th></tr>${playerRows.join('')}</table>`,
  );
}

function page(title, css, body) {
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><title>${title}</title>
<style>body{font-family:Georgia,serif;margin:10mm;color:#111}@page{margin:10mm}${css}</style></head>
<body>${body}</body></html>\n`;
}

function escape(value) {
  return String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
