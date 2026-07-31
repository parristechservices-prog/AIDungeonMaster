const fs = require('fs');

const path = 'C:/dev/AIDM/src/lib/game/adventures/skt-nightstone/areas.ts';
let content = fs.readFileSync(path, 'utf8');

const coords = {
  gatehouse: { x: 0, y: 0 },
  drawbridge: { x: 0, y: -1 },
  south_square: { x: 0, y: -2 },
  nightstone_inn: { x: -1, y: -2 },
  stable: { x: -1, y: -3 },
  windmill: { x: -2, y: -4 },
  central_square: { x: 0, y: -3 },
  temple: { x: 1, y: -3 },
  bell_tower: { x: 2, y: -3 },
  general_store: { x: 1, y: -2 },
  trading_post: { x: 1, y: -4 },
  keep_gate: { x: 0, y: -5 },
  keep_courtyard: { x: 0, y: -6 },
  great_hall: { x: 0, y: -7 },
  keep_bridge: { x: 1, y: -6 },
};

for (const [id, c] of Object.entries(coords)) {
  const target = `id: '${id}',\n      name: `;
  const replacement = `id: '${id}',\n      x: ${c.x},\n      y: ${c.y},\n      name: `;
  content = content.replace(target, replacement);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Done!');
