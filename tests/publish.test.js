// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { Window } from 'happy-dom';
import { loadLegacy } from './legacy-loader.js';

let pubHTML;

beforeAll(async () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)[1];
  await import('../src/app.js');
  document.getElementById('pubBtn').click();
  pubHTML = document.getElementById('pubTA').value;
});

describe('تصدير نسخة النشر', () => {
  it('يولّد مستند HTML مستقلًا بنسخة viewer و RTL', () => {
    expect(pubHTML.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(pubHTML).toContain('<html lang="ar" dir="rtl">');
    expect(pubHTML).toContain('<body class="viewer">');
    expect(pubHTML.trim().endsWith('</html>')).toBe(true);
  });

  it('لا يحوي أسطر import/export ولا وسوم module', () => {
    expect(pubHTML).not.toMatch(/^\s*import /m);
    expect(pubHTML).not.toMatch(/^\s*export \{/m);
    expect(pubHTML).not.toContain('type="module"');
  });

  it('يضمّ CSS كاملًا والبيانات الحالية', () => {
    expect(pubHTML).toContain('Aleppo Transit Design System');
    expect(pubHTML).toContain('const MAP_DATA = {"stations"');
    expect(pubHTML).toContain('الزهراء|جامع عائشة');
  });

  it('سكربتا البيانات والمنطق يعملان والنتائج مطابقة لـ legacy', () => {
    const scripts = [...pubHTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    expect(scripts).toHaveLength(3);
    const [dataJS, logicJS, appJS] = scripts;

    const ctx = vm.createContext({});
    vm.runInContext(dataJS + '\n' + logicJS, ctx);
    const out = vm.runInContext(
      `JSON.stringify(findRoute(MAP_DATA, buildGraph(MAP_DATA), 'rajaa', 'qalaa'))`,
      ctx
    );
    const legacy = loadLegacy();
    const expected = legacy.findRoute(
      legacy.MAP_DATA, legacy.buildGraph(legacy.MAP_DATA), 'rajaa', 'qalaa'
    );
    expect(JSON.parse(out)).toEqual(expected);

    // سكربت التطبيق سليم نحويًا (لا نشغّله: يحتاج DOM الصفحة المولّدة)
    expect(() => new vm.Script(appJS)).not.toThrow();
  });

  it('يضمّ هيكل الصفحة من دون أزرار الأدمن الفاعلة في CSS', () => {
    expect(pubHTML).toContain('id="goBtn"');
    expect(pubHTML).toContain('.viewer .admin-only{display:none!important}');
  });

  it('نسخة الـ Viewer المولّدة تُقلع كاملة في نافذة مستقلة', () => {
    const win = new Window();
    const body = pubHTML
      .match(/<body class="viewer">([\s\S]*)<\/body>/)[1]
      .replace(/<script>[\s\S]*?<\/script>/g, '');
    win.document.body.className = 'viewer';
    win.document.body.innerHTML = body;
    const scripts = [...pubHTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    vm.runInContext(scripts.join('\n;\n'), vm.createContext(win));

    expect(win.document.querySelectorAll('.stn').length).toBe(75);
    expect(win.document.querySelectorAll('#linesList .linechip').length).toBe(11);

    // حساب رحلة داخل الـ Viewer
    const stn = win.document.querySelector('.stn[data-id="rajaa"]');
    stn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    win.document.getElementById('popA').click();
    const stn2 = win.document.querySelector('.stn[data-id="baladi"]');
    stn2.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    win.document.getElementById('popB').click();
    expect(win.document.getElementById('result').textContent).toContain('تذكرة الرحلة');
  });
});
