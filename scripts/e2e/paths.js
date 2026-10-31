// Playwright loads its TypeScript fixtures as CommonJS; Node also imports this from ESM.
const path = process.getBuiltinModule('node:path');
exports.ROOT = path.resolve(__dirname, '../../.e2e-runs');
