import type { IndexWorkerMessage, IndexWorkerResult } from "@/lib/editor/indexWorker";

/** Run the real worker module with only its global message boundary substituted. */
export async function loadIndexWorker() {
  let result: IndexWorkerResult | undefined;
  const scope = {
    onmessage: null as ((event: MessageEvent<IndexWorkerMessage>) => void) | null,
    postMessage: (message: IndexWorkerResult) => { result = message; },
  };
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "self");
  const install = () => Object.defineProperty(globalThis, "self", { configurable: true, value: scope });
  const restore = () => {
    if (descriptor) Object.defineProperty(globalThis, "self", descriptor);
    else Reflect.deleteProperty(globalThis, "self");
  };
  install();
  try { await import("@/lib/editor/indexWorker"); } finally { restore(); }
  if (!scope.onmessage) throw new Error("Index worker did not register its message handler");
  return (message: IndexWorkerMessage): IndexWorkerResult => {
    result = undefined;
    install();
    try { scope.onmessage!({ data: message } as MessageEvent<IndexWorkerMessage>); } finally { restore(); }
    if (!result) throw new Error("Index worker did not return a result");
    return result;
  };
}
