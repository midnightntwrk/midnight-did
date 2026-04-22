import { writeFile } from "node:fs/promises";
import { URL } from "node:url";

import { createPrototypeAppState } from "./view-model.js";

const outputUrl = new URL("../app/prototype-state.json", import.meta.url);
await writeFile(
  outputUrl,
  `${JSON.stringify(createPrototypeAppState(), null, 2)}\n`,
);
