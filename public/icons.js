// A small inline subset adapted from Lucide Icons.
// License details: ../THIRD-PARTY-NOTICES.md

const ICONS = {
  heading: [
    ['path', { d: 'M4 5v14' }],
    ['path', { d: 'M20 5v14' }],
    ['path', { d: 'M4 12h16' }],
    ['path', { d: 'M4 5h5' }],
    ['path', { d: 'M15 5h5' }],
    ['path', { d: 'M4 19h5' }],
    ['path', { d: 'M15 19h5' }]
  ],
  code: [
    ['path', { d: 'm18 16 4-4-4-4' }],
    ['path', { d: 'm6 8-4 4 4 4' }],
    ['path', { d: 'm14.5 4-5 16' }]
  ],
  play: [
    ['polygon', { points: '6 3 20 12 6 21 6 3' }]
  ],
  workflow: [
    ['rect', { width: '7', height: '7', x: '3', y: '3', rx: '1' }],
    ['rect', { width: '7', height: '7', x: '14', y: '14', rx: '1' }],
    ['path', { d: 'M10 6h2a4 4 0 0 1 4 4v4' }],
    ['path', { d: 'M14 18h-2a4 4 0 0 1-4-4v-4' }]
  ],
  prompt: [
    ['path', { d: 'M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z' }],
    ['path', { d: 'M8 9h8' }],
    ['path', { d: 'M8 13h5' }]
  ],
  image: [
    ['rect', { width: '18', height: '18', x: '3', y: '3', rx: '2' }],
    ['circle', { cx: '9', cy: '9', r: '2' }],
    ['path', { d: 'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21' }]
  ],
  table: [
    ['rect', { width: '18', height: '18', x: '3', y: '3', rx: '2' }],
    ['path', { d: 'M3 9h18' }],
    ['path', { d: 'M3 15h18' }],
    ['path', { d: 'M9 3v18' }],
    ['path', { d: 'M15 3v18' }]
  ],
  quote: [
    ['path', { d: 'M3 21c3 0 5-2 5-5V7c0-2-1-3-3-3S2 5 2 7v3h4' }],
    ['path', { d: 'M17 21c3 0 5-2 5-5V7c0-2-1-3-3-3s-3 1-3 3v3h4' }]
  ],
  math: [
    ['path', { d: 'M18 7V4H6l6 8-6 8h12v-3' }]
  ],
  footnote: [
    ['path', { d: 'M4 19h16' }],
    ['path', { d: 'M6 17V5' }],
    ['path', { d: 'M6 5h6a4 4 0 0 1 0 8H6' }],
    ['path', { d: 'M17 7v4' }],
    ['path', { d: 'M15 9h4' }]
  ],
  bold: [
    ['path', { d: 'M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z' }],
    ['path', { d: 'M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z' }],
    ['path', { d: 'M6 4v16' }]
  ],
  italic: [
    ['line', { x1: '19', x2: '10', y1: '4', y2: '4' }],
    ['line', { x1: '14', x2: '5', y1: '20', y2: '20' }],
    ['line', { x1: '15', x2: '9', y1: '4', y2: '20' }]
  ],
  strike: [
    ['path', { d: 'M16 4H9a3 3 0 0 0-2.83 4' }],
    ['path', { d: 'M8 20h7a3 3 0 0 0 2.83-4' }],
    ['line', { x1: '4', x2: '20', y1: '12', y2: '12' }]
  ],
  palette: [
    ['circle', { cx: '13.5', cy: '6.5', r: '.5' }],
    ['circle', { cx: '17.5', cy: '10.5', r: '.5' }],
    ['circle', { cx: '8.5', cy: '7.5', r: '.5' }],
    ['circle', { cx: '6.5', cy: '12.5', r: '.5' }],
    ['path', { d: 'M12 2a10 10 0 1 0 10 10c0-1.1-.9-2-2-2h-2.5a2.5 2.5 0 0 1-2.5-2.5V7a5 5 0 0 0-5-5Z' }]
  ],
  highlight: [
    ['path', { d: 'm9 11-6 6v3h3l6-6' }],
    ['path', { d: 'm14 5 5 5' }],
    ['path', { d: 'm12 7 5-5 5 5-5 5z' }]
  ],
  upload: [
    ['path', { d: 'M12 3v12' }],
    ['path', { d: 'm17 8-5-5-5 5' }],
    ['path', { d: 'M5 21h14' }]
  ],
  alignCenter: [
    ['line', { x1: '17', x2: '7', y1: '10', y2: '10' }],
    ['line', { x1: '21', x2: '3', y1: '6', y2: '6' }],
    ['line', { x1: '21', x2: '3', y1: '14', y2: '14' }],
    ['line', { x1: '17', x2: '7', y1: '18', y2: '18' }]
  ],
  alignLeft: [
    ['line', { x1: '15', x2: '3', y1: '10', y2: '10' }],
    ['line', { x1: '21', x2: '3', y1: '6', y2: '6' }],
    ['line', { x1: '21', x2: '3', y1: '14', y2: '14' }],
    ['line', { x1: '15', x2: '3', y1: '18', y2: '18' }]
  ],
  alignRight: [
    ['line', { x1: '21', x2: '9', y1: '10', y2: '10' }],
    ['line', { x1: '21', x2: '3', y1: '6', y2: '6' }],
    ['line', { x1: '21', x2: '3', y1: '14', y2: '14' }],
    ['line', { x1: '21', x2: '9', y1: '18', y2: '18' }]
  ],
  plus: [
    ['path', { d: 'M5 12h14' }],
    ['path', { d: 'M12 5v14' }]
  ],
  close: [
    ['path', { d: 'M18 6 6 18' }],
    ['path', { d: 'm6 6 12 12' }]
  ],
  settings: [
    ['path', { d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' }],
    ['circle', { cx: '12', cy: '12', r: '3' }]
  ]
};

function createSvg(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('lucide');

  for (const [tagName, attributes] of ICONS[name] || []) {
    const child = document.createElementNS('http://www.w3.org/2000/svg', tagName);
    for (const [attribute, value] of Object.entries(attributes)) child.setAttribute(attribute, value);
    svg.append(child);
  }

  return svg;
}

export function renderIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((container) => {
    const name = container.dataset.icon;
    if (!ICONS[name]) return;
    container.replaceChildren(createSvg(name));
  });
}
