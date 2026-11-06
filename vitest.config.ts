import { defineConfig } from 'vitest/config';

// Eigene Test-Konfiguration, damit Vitest' Vite-Version nicht mit der App-Konfiguration kollidiert.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
