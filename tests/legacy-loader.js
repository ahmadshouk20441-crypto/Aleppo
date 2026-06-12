import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

/* يستخرج وسوم السكربت المسمّاة من ملف legacy ويقيّمها في Node كما هي،
   اعتمادًا على حارس module.exports الموجود أصلًا في map-logic. */
export function loadLegacy() {
  const html = readFileSync(
    resolve(process.cwd(), 'legacy/aleppo-transit-original.html'),
    'utf8'
  );
  const grab = (id) => {
    const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`));
    if (!m) throw new Error('script tag not found: ' + id);
    return m[1];
  };
  const module = { exports: {} };
  const ctx = vm.createContext({ module });
  vm.runInContext(grab('map-data'), ctx);
  vm.runInContext(grab('map-logic'), ctx);
  return ctx.module.exports;
}
