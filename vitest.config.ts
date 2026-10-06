import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    passWithNoTests: true,
    isolate: false,
    pool: 'forks',
    server: {
      deps: {
        inline: [/sql\.js/],
      },
    },
  },
})
