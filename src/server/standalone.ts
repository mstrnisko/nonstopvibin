import { resolve } from "node:path";
import { Application } from "./server.ts";
import { dataDirectory } from "./data-directory.ts";

const application = await Application.create({
  directory: dataDirectory(),
  binary: resolve(".vendor/core/cli-proxy-api"),
  clientDirectory: resolve("dist/client"),
  port: Number(process.env.NONSTOPVIBIN_PORT || 4318),
  development: true,
});
console.log(`nonstopvibin API: ${application.origin}`);
console.log(
  `Open the local interface: http://127.0.0.1:5173/#session=${application.token}`,
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    application.close().then(
      () => process.exit(0),
      (error) => {
        console.error(error);
        process.exit(1);
      },
    );
  });
