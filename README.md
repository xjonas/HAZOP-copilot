## HAZOP Copilot

## Architecture Notes
- App routes use Next.js App Router under `src/app` with route groups:
	- `src/app/(auth)` for authentication pages
	- `src/app/(app)` for authenticated application UI
	- `src/app/api` for server endpoints
- Shared frontend state/hooks live in `src/hooks`.
- Server-side integration helpers live in `src/lib`.

## API Access Policy (P0)
- App-called AI and meeting endpoints require:
	- a valid `Authorization: Bearer <token>` header
	- authenticated user resolution
	- verified org membership for the target project
- Centralized access checks are implemented in `src/lib/api/access-control.ts` and should be reused by new project-scoped API routes.

## Refactor Scope
- SQL migration files were intentionally not modified in this refactor pass.

## Future work 
- Spcialized Object detection model instead of VLM
- Convert Larger Flowsheet to knowledge graph
- React query caching to reduce database requests
- Multiple language support
- LLM rate limiting
- Admin can send invitations to users
- RAG System with past projects, internal documents, regulatory documents, etc. (probably vector database)
- More comprehensive final HAZOP agent with multiple steps and checks using Langgraph (then also with queueing)


