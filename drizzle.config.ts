import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server.ts', # Pointing to the schema defined in server.ts
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'file:./wilder.db',
  },
});
