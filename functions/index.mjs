// Firebase entry point. firebase.json rewrites /listing/<id>, /u/<id> and
// /<username> here; see docs/share-previews.md.
import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";

import { createHandler, parseBackends } from "./preview.mjs";

// Close to both backends (staging eu-west-1 Dublin, production eu-central-1
// Frankfurt) and one of the regions Firebase recommends for Hosting rewrites.
setGlobalOptions({ region: "europe-west1" });

// HEMU_BACKENDS comes from functions/.env: backend names in lookup order.
const backends = parseBackends(process.env.HEMU_BACKENDS);

export const sharepreview = onRequest(
  {
    invoker: "public",
    minInstances: 0,
    maxInstances: 5,
    concurrency: 40,
    cpu: 1,
    memory: "256MiB",
    timeoutSeconds: 10,
  },
  createHandler({ backends }),
);
