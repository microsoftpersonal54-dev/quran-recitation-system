import { createServer } from "node:https";
import { parse } from "node:url";
import { readFileSync } from "node:fs";
import next from "next";

const dev = false;
const hostname = "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: readFileSync("./certs/server.key"),
  cert: readFileSync("./certs/server.crt"),
};

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, hostname, () => {
    console.log(`▲ HTTPS production server`);
    console.log(`- Local:        https://localhost:${port}`);
    console.log(`- Network:      https://192.168.18.106:${port}`);
    console.log("✓ Ready");
  });
});