import { describe, it, expect } from 'vitest';
import { loadLegacy } from './legacy-loader.js';
import { runSuite } from './suite.js';

import { MAP_DATA } from '../src/data/map-data.js';
import { normAr, dispName } from '../src/core/text.js';
import { offsetPolyline, roundedPath } from '../src/core/geometry.js';
import { buildRuns, runPoints } from '../src/core/network.js';
import { buildGraph, findRoute } from '../src/core/routing.js';

const api = {
  MAP_DATA, normAr, dispName, offsetPolyline, roundedPath,
  buildRuns, runPoints, buildGraph, findRoute,
};

/* نفس مجموعة التوصيف الذهبية تعمل على الوحدات المستخرجة */
runSuite('src modules', api);

/* تطابق حرفي مع نسخة legacy */
describe('تطابق src مع legacy', () => {
  const legacy = loadLegacy();

  it('MAP_DATA متطابقة بالكامل (أسماء، إحداثيات، ألوان، مسارات)', () => {
    expect(JSON.parse(JSON.stringify(MAP_DATA)))
      .toEqual(JSON.parse(JSON.stringify(legacy.MAP_DATA)));
  });

  it('findRoute يعطي النتيجة نفسها لكل أزواج المحطات', () => {
    const adjNew = buildGraph(MAP_DATA);
    const adjOld = legacy.buildGraph(legacy.MAP_DATA);
    const ids = Object.keys(MAP_DATA.stations);
    for (const a of ids) for (const b of ids) {
      if (a === b) continue;
      const rNew = findRoute(MAP_DATA, adjNew, a, b);
      const rOld = legacy.findRoute(legacy.MAP_DATA, adjOld, a, b);
      expect(rNew, `${a}→${b}`).toEqual(rOld);
    }
  });

  it('buildRuns يعطي الأشواط والفتحات نفسها', () => {
    const bNew = buildRuns(MAP_DATA);
    const bOld = legacy.buildRuns(legacy.MAP_DATA);
    expect(bNew.slots).toEqual(bOld.slots);
    expect(bNew.runs.map(r => [r.li, r.pi, r.a, r.b, r.oneWay, r.bends]))
      .toEqual(bOld.runs.map(r => [r.li, r.pi, r.a, r.b, r.oneWay, r.bends]));
  });

  it('runPoints يعطي النقاط نفسها لكل شوط', () => {
    const bNew = buildRuns(MAP_DATA);
    const bOld = legacy.buildRuns(legacy.MAP_DATA);
    bNew.runs.forEach((r, i) => {
      expect(runPoints(r, bNew.slots, MAP_DATA, 8))
        .toEqual(legacy.runPoints(bOld.runs[i], bOld.slots, legacy.MAP_DATA, 8));
    });
  });

  it('roundedPath متطابق على مسارات حقيقية', () => {
    const bNew = buildRuns(MAP_DATA);
    for (const r of bNew.runs) {
      const pts = runPoints(r, bNew.slots, MAP_DATA, 8);
      expect(roundedPath(pts, 15)).toBe(legacy.roundedPath(pts, 15));
    }
  });

  it('normAr متطابق على كل أسماء المحطات', () => {
    for (const id of Object.keys(MAP_DATA.stations)) {
      const n = MAP_DATA.stations[id].name;
      expect(normAr(n)).toBe(legacy.normAr(n));
      expect(dispName(n)).toBe(legacy.dispName(n));
    }
  });
});
