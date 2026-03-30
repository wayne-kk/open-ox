import * as net from "net";

/**
 * Check if a port is free by attempting to bind on both 0.0.0.0 (IPv4) and ::
 * (IPv6). Both must succeed for the port to be considered available.
 *
 * Using bind (not connect) avoids the race window between "check" and "use".
 * We set SO_REUSEADDR=false (default) so we get an accurate picture.
 */
function tryBind(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => {
      resolve(false);
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function isPortFree(port: number): Promise<boolean> {
  // Must be free on both IPv4 and IPv6 interfaces
  const [v4, v6] = await Promise.all([
    tryBind(port, "0.0.0.0"),
    tryBind(port, "::"),
  ]);
  return v4 && v6;
}

/**
 * Scans ports starting at `startPort` (default 3100) up to 3200 and returns
 * the first port that is free on both IPv4 and IPv6.
 *
 * @throws Error if no free port is found in the range 3100–3200
 */
export async function findAvailablePort(startPort = 3100): Promise<number> {
  const maxPort = 3200;
  for (let port = startPort; port <= maxPort; port++) {
    if (await isPortFree(port)) {
      return port;
    }
  }
  throw new Error("No available port found in range 3100-3200");
}
