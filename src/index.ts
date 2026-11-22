#!/usr/bin/env bun
/**
 * VoiceBox MCP Server Entrypoint
 * Biophysical Vocal Synthesis Server for AI Agents using MCP (Model Context Protocol).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ChimeraEngine } from "./ffi/engine.ts";
import { registerAllTools } from "./tools/registry.ts";

export function createServer(): { server: McpServer; engine: ChimeraEngine } {
  const server = new McpServer({
    name: "voicebox-mcp",
    version: "1.0.0",
  });

  const engine = new ChimeraEngine(48000.0);
  registerAllTools(server, engine);

  return { server, engine };
}

async function main() {
  const { server } = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("VoiceBox MCP Server running on stdio (48kHz physical vocal tract engine)");
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Fatal error in VoiceBox MCP Server:", err);
    process.exit(1);
  });
}
