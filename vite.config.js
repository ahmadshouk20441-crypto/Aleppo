import { defineConfig } from 'vite';

export default defineConfig({
  // مسار النشر على GitHub Pages: https://<user>.github.io/Aleppo/
  base: '/Aleppo/',
  // الخريطة تعتمد على مستمعي window/document المسجّلين مرة واحدة عند الإقلاع،
  // لذا نعيد تحميل الصفحة كاملة بدل HMR لتجنّب تكرار المستمعين.
  server: {
    hmr: false,
  },
  test: {
    environment: 'node',
    css: true,
  },
});
