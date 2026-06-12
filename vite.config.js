import { defineConfig } from 'vite';

export default defineConfig({
  // الخريطة تعتمد على مستمعي window/document المسجّلين مرة واحدة عند الإقلاع،
  // لذا نعيد تحميل الصفحة كاملة بدل HMR لتجنّب تكرار المستمعين.
  server: {
    hmr: false,
  },
  test: {
    environment: 'node',
  },
});
