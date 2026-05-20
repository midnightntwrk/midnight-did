import { WebSocket } from "ws";

// Apollo/ws expects a WebSocket constructor on globalThis in Node.js runtimes.
// Keep this side effect separate so deep imports can opt into the same runtime
// setup as the public package barrel.
// @ts-expect-error assign for apollo/ws
globalThis.WebSocket = WebSocket;
