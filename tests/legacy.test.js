import { loadLegacy } from './legacy-loader.js';
import { runSuite } from './suite.js';

runSuite('legacy', loadLegacy());
