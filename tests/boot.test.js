// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/* اختبار إقلاع: يحمّل هيكل index.html الحقيقي ثم يشغّل التطبيق
   ويتأكد أن الخريطة والمفتاح والإحصاءات تُبنى دون أخطاء. */
beforeAll(async () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
  document.body.innerHTML = body;
  await import('../src/app.js');
});

describe('إقلاع التطبيق', () => {
  it('يرسم المحطات والخطوط داخل SVG', () => {
    const svg = document.getElementById('map');
    expect(svg.querySelectorAll('.stn').length).toBe(75);
    expect(svg.querySelectorAll('.run').length).toBeGreaterThan(0);
  });

  it('يملأ قائمة الخطوط (11 خطًا)', () => {
    expect(document.querySelectorAll('#linesList .linechip').length).toBe(11);
  });

  it('يعرض الإحصاءات الصحيحة', () => {
    const stats = document.getElementById('stats').textContent;
    expect(stats).toContain('11');
    expect(stats).toContain('75');
  });

  it('يحسب رحلة ويعرض التذكرة', () => {
    const stn = document.querySelector('.stn[data-id="rajaa"]');
    expect(stn).toBeTruthy();
    // تعيين أ/ب برمجيًا عبر النقر على المحطة ثم زر الانطلاق
    stn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.getElementById('popA').click();
    const stn2 = document.querySelector('.stn[data-id="baladi"]');
    stn2.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.getElementById('popB').click();
    const result = document.getElementById('result').textContent;
    expect(result).toContain('تذكرة الرحلة');
    expect(result).toContain('تبديل');
  });

  it('الوضع الليلي يبدّل فئة body', () => {
    // happy-dom لا يربط this بالعنصر عند click()، فنستدعي المعالج مباشرة
    const btn = document.getElementById('themeBtn');
    btn.onclick.call(btn);
    expect(document.body.classList.contains('dark')).toBe(true);
    btn.onclick.call(btn);
    expect(document.body.classList.contains('dark')).toBe(false);
  });
});
