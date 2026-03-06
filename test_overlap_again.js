const fs = require('fs');
const plan = JSON.parse(fs.readFileSync('plan_latest.json', 'utf8'));
const vMap = new Map();
plan.vertices.forEach(v => vMap.set(v.id, v));

function lineIntersection(p1, p2, p3, p4) {
  const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;
  const denom = (y4-y3)*(x2-x1) - (x4-x3)*(y2-y1);
  if (denom === 0) return null;
  const ua = ((x4-x3)*(y1-y3) - (y4-y3)*(x1-x3)) / denom;
  const ub = ((x2-x1)*(y1-y3) - (y2-y1)*(x1-x3)) / denom;
  return { ua, ub, intersect: ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1 };
}

let u1 = plan.units[1];
let u32 = plan.units[32]; // corridor
let p1 = vMap.get(u1.polygon[1]); // v4
let q1 = vMap.get(u1.polygon[2]); // v5
let p2 = vMap.get(u1.polygon[3]); // v2
// so the right edge of U1 is v5 to v2

let pC = vMap.get(u32.polygon[0]); // v3
let qC = vMap.get(u32.polygon[1]); // v14
// so the left edge of corridor is v3 to v14

console.log("U1 right edge:", p1.id, q1.id, p2.id); // Wait, U1 is v1, v4, v5, v2. So right edge is v5-v2!
console.log(`v5: ${q1.x}, ${q1.y}`);
console.log(`v2: ${p2.x}, ${p2.y}`);
console.log(`Corridor left edge v3-v14:`);
console.log(`v3: ${pC.x}, ${pC.y}`);
console.log(`v14: ${qC.x}, ${qC.y}`);

let result = lineIntersection(q1, p2, pC, qC);
console.log("Intersection U1 right edge with Corridor left edge:", result);
