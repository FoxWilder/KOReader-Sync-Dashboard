import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'file:./wilder.db',
  },
});
