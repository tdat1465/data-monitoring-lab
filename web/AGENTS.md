Last updated: 2026-05-09

# Agent Guidelines - IDA Data Monitoring Web

## General Principles

1. **Always read CLAUDE.md first** - It contains the full project context
2. **Follow the directory structure** - Keep files in their designated locations
3. **Use TypeScript** - No JavaScript files for new code
4. **Use existing patterns** - Copy from similar existing code when possible
5. **Test changes** - Verify API routes work before marking as complete

## Project-Specific Rules

### Database Changes

- **Always use parameterized queries** - Never interpolate user input into SQL
  ```typescript
  // GOOD
  await query('SELECT * FROM flights WHERE flight_date = $1', [date]);

  // BAD
  await query(`SELECT * FROM flights WHERE flight_date = '${date}'`);
  ```

- **Use connection pooling** - Import `query` from `@/lib/db`, not direct `pg.Client`
  ```typescript
  import { query } from '@/lib/db';
  ```

- **TRIGGER files go in** `src/db/migrations/` - Follow naming `XXX_description.sql`

### API Routes

- **Always return JSON with consistent structure**
  ```typescript
  return NextResponse.json({ data: result.rows, meta: { total } });
  ```

- **Handle errors gracefully**
  ```typescript
  try {
    const result = await query(sql, params);
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('Query failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
  ```

- **Validate inputs with Zod** when available

### SSE (Server-Sent Events)

- **Use existing dbListener pattern** - Don't create new LISTEN implementations
  ```typescript
  import { DbListener, type NotificationPayload } from '@/lib/dbListener';
  ```

- **Short listen pattern** - 25s listen + reconnect for serverless compatibility

- **Handle reconnection** - SSE clients auto-reconnect, server should handle gracefully

### Components

- **Use 'use client' directive** for interactive components
  ```typescript
  'use client';

  export function InteractiveComponent() { ... }
  ```

- **Server Components by default** - Only add 'use client' when needed

- **Co-locate styles** - Use Tailwind classes, avoid separate CSS files

### Type Safety

- **Define types in** `src/types/` - Flight, Weather, etc.
- **Import types explicitly**
  ```typescript
  import type { Flight } from '@/types/flight';
  ```

## Do's and Don'ts

### ✅ DO

- Read existing similar components before creating new ones
- Use the established query patterns from `src/lib/queries/`
- Follow the naming conventions in the codebase
- Add proper error handling
- Test changes locally before completing

### ❌ DON'T

- Create new database connection logic - use `@/lib/db`
- Write raw SQL in API routes - use query functions from `src/lib/queries/`
- Use `console.log` for production errors - use proper logging
- Skip 'use client' for interactive components
- Hardcode environment variables - use `process.env`
- Create files outside the designated directories

## File Locations

| Type | Location |
|------|----------|
| API routes | `src/app/api/` |
| Page components | `src/app/` |
| UI components | `src/components/ui/` |
| Domain components | `src/components/flights/`, `src/components/weather/`, etc. |
| Hooks | `src/hooks/` |
| Utilities | `src/lib/utils/` |
| Queries | `src/lib/queries/` |
| Types | `src/types/` |
| Migrations | `src/db/migrations/` |

## Common Tasks

### Adding a new API endpoint

1. Create route file: `src/app/api/[resource]/route.ts`
2. Use existing query pattern or add to `src/lib/queries/`
3. Return consistent JSON structure
4. Add TypeScript types for request/response

### Adding a new component

1. Choose correct location (`src/components/[domain]/`)
2. Follow existing component patterns
3. Use Tailwind for styling
4. Add 'use client' if interactive
5. Export from parent or index if needed

### Adding a new query

1. Create file in `src/lib/queries/`
2. Use parameterized queries
3. Return typed results
4. Document in CLAUDE.md if complex

## Troubleshooting

### "Cannot find module '@/lib/db'"

- Check that `tsconfig.json` has path alias configured
- Verify file is in `src/lib/` directory

### "SSE not working"

- Check `dbListener.ts` is properly initialized
- Verify PostgreSQL TRIGGER exists: run migration
- Check `DATABASE_URL` environment variable is set

### "Type error on Flight type"

- Verify interface matches database columns
- Check nullable fields match schema

## Convention References

- **Commits:** Use Conventional Commits (feat:, fix:, docs:, refactor:)
- **Naming:** PascalCase for components, camelCase for functions/hooks
- **Imports:** Use `@/` path alias for internal imports

---

*Follow these guidelines to maintain consistency across the project.*
