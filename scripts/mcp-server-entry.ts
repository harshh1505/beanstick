// Stdio entrypoint used by scripts/verify-mcp-stdio.ts
import { createFiatAgentMCPServer } from '../protocol/mcp/server';

const server = createFiatAgentMCPServer();
server.start().catch((err) => {
  console.error(err);
  process.exit(1);
});
