import { describe, it, expect } from 'vitest';

/* مجموعة اختبارات توصيف مشتركة: تعمل على نسخة legacy الآن،
   وعلى وحدات src بعد الاستخراج، لضمان تطابق السلوك حرفيًا. */
export function runSuite(name, api) {
  const {
    MAP_DATA, normAr, dispName, offsetPolyline, roundedPath,
    buildRuns, runPoints, buildGraph, findRoute,
  } = api;

  describe(`${name}: سلامة بيانات MAP_DATA`, () => {
    it('العدد الصحيح للمحطات والخطوط', () => {
      expect(Object.keys(MAP_DATA.stations)).toHaveLength(75);
      expect(MAP_DATA.lines).toHaveLength(11);
    });

    it('كل محطة في المسارات معرّفة في stations', () => {
      for (const line of MAP_DATA.lines)
        for (const path of line.paths)
          for (const s of path.stops)
            expect(MAP_DATA.stations[s], `${line.id}:${s}`).toBeDefined();
    });

    it('كل مفتاح via يطابق زوج محطات متجاورتين في المسار', () => {
      for (const line of MAP_DATA.lines)
        for (const path of line.paths) {
          if (!path.via) continue;
          for (const key of Object.keys(path.via)) {
            const [a, b] = key.split('>');
            const ok = path.stops.some(
              (s, i) =>
                (s === a && path.stops[i + 1] === b) ||
                (s === b && path.stops[i + 1] === a)
            );
            expect(ok, `${line.id} via ${key}`).toBe(true);
          }
        }
    });

    it('كل خط له اسم ولون ونوع صالحان', () => {
      for (const line of MAP_DATA.lines) {
        expect(line.name).toBeTruthy();
        expect(line.color).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(['باص', 'سرفيس']).toContain(line.type);
      }
    });
  });

  describe(`${name}: تطبيع النص العربي normAr`, () => {
    it('يزيل التشكيل والتطويل', () => {
      expect(normAr('مَدْرَسَةٌ')).toBe(normAr('مدرسه'));
      expect(normAr('جـــامع')).toBe('جامع');
    });
    it('يوحّد الهمزات والتاء المربوطة والياء والواو', () => {
      expect(normAr('أحمد')).toBe(normAr('احمد'));
      expect(normAr('إشارة')).toBe(normAr('اشاره'));
      expect(normAr('آخر')).toBe(normAr('اخر'));
      expect(normAr('مستشفى')).toBe(normAr('مستشفي'));
      expect(normAr('مسؤول')).toBe(normAr('مسوول'));
    });
    it('يعامل | كمسافة ويطوي المسافات المتكررة', () => {
      expect(normAr('دوار|المالية')).toBe(normAr('دوار  المالية'));
    });
    it('يعيد سلسلة فارغة للمدخلات الفارغة', () => {
      expect(normAr('')).toBe('');
      expect(normAr(null)).toBe('');
      expect(normAr(undefined)).toBe('');
    });
  });

  describe(`${name}: dispName`, () => {
    it('يستبدل | بمسافة', () => {
      expect(dispName('دوار|المالية')).toBe('دوار المالية');
    });
  });

  describe(`${name}: الهندسة`, () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];

    it('offsetPolyline بدون إزاحة يعيد نسخة من النقاط', () => {
      const out = offsetPolyline(pts, 0);
      expect(out).toEqual(pts);
      expect(out[0]).not.toBe(pts[0]);
    });

    it('offsetPolyline يزيح عموديًا على المقطع', () => {
      const out = offsetPolyline([{ x: 0, y: 0 }, { x: 100, y: 0 }], 8);
      expect(out[0].y).toBeCloseTo(8);
      expect(out[1].y).toBeCloseTo(8);
      expect(out[0].x).toBeCloseTo(0);
    });

    it('roundedPath يبدأ بـ M وينتهي بنقطة النهاية', () => {
      const d = roundedPath(pts, 15);
      expect(d.startsWith('M 0 0')).toBe(true);
      expect(d.endsWith('L 100 100')).toBe(true);
      expect(d).toContain('Q');
    });

    it('roundedPath لنقطتين يكون مستقيمًا', () => {
      expect(roundedPath([{ x: 0, y: 0 }, { x: 50, y: 0 }], 15)).toBe('M 0 0 L 50 0');
    });
  });

  describe(`${name}: بناء الشبكة`, () => {
    it('buildRuns يبني شوطًا لكل مقطع متتالٍ', () => {
      const { runs, slots } = buildRuns(MAP_DATA);
      const expected = MAP_DATA.lines.reduce(
        (n, l) => n + l.paths.reduce((m, p) => m + p.stops.length - 1, 0), 0
      );
      expect(runs).toHaveLength(expected);
      for (const r of runs) expect(slots[r.key][r.li]).toBeDefined();
    });

    it('الممرات المشتركة تتوزّع على فتحات متناظرة حول الصفر', () => {
      const { slots } = buildRuns(MAP_DATA);
      for (const key of Object.keys(slots)) {
        const vals = Object.values(slots[key]);
        const sum = vals.reduce((a, b) => a + b, 0);
        expect(Math.abs(sum)).toBeLessThan(1e-9);
      }
    });

    it('runPoints يلتزم الإزاحة القياسية للاتجاهين', () => {
      const built = buildRuns(MAP_DATA);
      for (const r of built.runs.slice(0, 30)) {
        const pts = runPoints(r, built.slots, MAP_DATA, 8);
        expect(pts.length).toBe(2 + (r.bends ? r.bends.length : 0));
      }
    });

    it('buildGraph يحترم oneWay: لا حافة عكسية في الحلقات', () => {
      const adj = buildGraph(MAP_DATA);
      // حلقة صلاح الدين أحادية الاتجاه: bazerkan→seif موجودة والعكس لا
      // (العكس عبر هذا الخط؛ قد توجد عبر خطوط أخرى بنفس المقطع)
      const fwd = adj['bazerkan'].filter(e => e.to === 'seif' && e.line === 'salah');
      const back = adj['seif'].filter(e => e.to === 'bazerkan' && e.line === 'salah');
      expect(fwd).toHaveLength(1);
      expect(back).toHaveLength(0);
      // مقطع ثنائي الاتجاه عادي
      const f2 = adj['rajaa'].filter(e => e.to === 'rahmeh' && e.line === 'njs');
      const b2 = adj['rahmeh'].filter(e => e.to === 'rajaa' && e.line === 'njs');
      expect(f2).toHaveLength(1);
      expect(b2).toHaveLength(1);
    });
  });

  describe(`${name}: خوارزمية إيجاد المسار findRoute`, () => {
    const adj = buildGraph(MAP_DATA);
    const route = (a, b) => findRoute(MAP_DATA, adj, a, b);

    it('المحطة نفسها', () => {
      expect(route('jamia', 'jamia')).toEqual({ same: true });
    });

    it('رحلة مباشرة بلا تبديل على خط حلب الجديدة جنوبي', () => {
      const r = route('rajaa', 'baladi');
      expect(r.transfers).toBe(0);
      expect(r.legs).toHaveLength(1);
      expect(r.legs[0].line).toBe('njs');
      expect(r.legs[0].stops[0]).toBe('rajaa');
      expect(r.legs[0].stops.at(-1)).toBe('baladi');
    });

    it('كل مرحلة تبدأ حيث انتهت سابقتها', () => {
      const r = route('hashkal', 'qalaa');
      expect(r.legs.length).toBeGreaterThan(0);
      for (let i = 1; i < r.legs.length; i++)
        expect(r.legs[i].stops[0]).toBe(r.legs[i - 1].stops.at(-1));
      expect(r.legs[0].stops[0]).toBe('hashkal');
      expect(r.legs.at(-1).stops.at(-1)).toBe('qalaa');
      expect(r.transfers).toBe(r.legs.length - 1);
    });

    it('totalStops = مجموع مقاطع المراحل', () => {
      const r = route('zahraa', 'ramouseh');
      const sum = r.legs.reduce((n, l) => n + l.stops.length - 1, 0);
      expect(r.totalStops).toBe(sum);
    });

    it('يحترم الاتجاه الواحد: الدخول عكس سهم الحلقة يفرض الالتفاف', () => {
      // في حلقة صلاح الدين: seif→bazerkan ممنوعة مباشرة عبر الحلقة
      const r = route('seif', 'bazerkan');
      expect(r.legs).toBeTruthy();
      const flat = r.legs.flatMap(l => l.stops);
      // المسار المباشر العكسي طوله محطة واحدة؛ الالتفاف أو خط آخر أطول
      expect(flat.length).toBeGreaterThan(2);
    });

    it('يعيد null عند تعذّر الوصول', () => {
      const tiny = {
        stations: {
          a: { name: 'أ', x: 0, y: 0 }, b: { name: 'ب', x: 10, y: 0 },
          c: { name: 'ج', x: 100, y: 100 },
        },
        lines: [{ id: 'l1', name: 'خط', type: 'باص', color: '#000000',
                  paths: [{ stops: ['a', 'b'] }] }],
      };
      const tadj = buildGraph(tiny);
      expect(findRoute(tiny, tadj, 'a', 'c')).toBeNull();
    });

    it('كل زوج محطات على الشبكة الحقيقية قابل للوصول', () => {
      const ids = Object.keys(MAP_DATA.stations);
      for (const a of ids) for (const b of ids) {
        if (a === b) continue;
        const r = route(a, b);
        expect(r, `${a}→${b}`).toBeTruthy();
        expect(r.legs, `${a}→${b}`).toBeTruthy();
      }
    });
  });
}
