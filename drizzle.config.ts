import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: 'postgresql://neondb_owner:npg_zr4d5WGYJilp@ep-proud-wave-a5jso0by-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  },
} satisfies Config
