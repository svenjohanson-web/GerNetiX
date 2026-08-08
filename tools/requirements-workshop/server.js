const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const port = Number.parseInt(process.env.PORT || "4325", 10);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host || "localhost"}`).pathname;
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolvedPath = path.resolve(root, relativePath);

  if (!resolvedPath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(resolvedPath, (error, content) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(resolvedPath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(content);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Anforderungswerkstatt: http://127.0.0.1:${port}`);
});
