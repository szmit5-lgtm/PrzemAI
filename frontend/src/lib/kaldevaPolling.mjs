export function isKaldevaJobActive(status) {
  return status === "queued" || status === "running";
}

export function pollKaldevaJob({ load, onJob, onError, status, delay = 2500 }) {
  const controller = new AbortController();
  const { signal } = controller;
  let timer;
  async function read() {
    try {
      const job = await load(signal);
      if (signal.aborted) return;
      status = job.status;
      onJob(job);
    } catch (error) {
      if (signal.aborted) return;
      onError(error);
      if ([401, 403, 404].includes(error.status)) return;
    }
    if (!signal.aborted && isKaldevaJobActive(status)) timer = setTimeout(read, delay);
  }
  void read();
  return () => {
    controller.abort();
    clearTimeout(timer);
  };
}
