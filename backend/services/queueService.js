const queue = [];
let processing = false;

function enqueueJob(job) {
  if (job.type === "sync") {
    const syncAlreadyQueued = queue.some((queuedJob) => queuedJob.type === "sync");
    if (syncAlreadyQueued || processing) {
      return;
    }
  }

  const MAX_QUEUE_SIZE = Number(process.env.MAX_QUEUE_SIZE || 1000);

  if (queue.length >= MAX_QUEUE_SIZE) {
    throw new Error("Queue capacity exceeded");
  }

  queue.push({
    ...job,
    createdAt: new Date()
  });

  processQueue().catch((error) => {
    console.error("Queue processing failed:", error.message);
  });
}

async function processQueue() {
  if (processing) return;

  processing = true;

  try {
    while (queue.length > 0) {
      const job = queue.shift();

      if (job.type === "sync" && typeof job.handler === "function") {
        try {
          await job.handler();
        } catch (error) {
          console.error("Queued job failed:", {
            type: job.type,
            createdAt: job.createdAt,
            message: error.message,
            stack: process.env.NODE_ENV === "production" ? undefined : error.stack
          });
        }
      }
    }
  } finally {
    processing = false;
  }
}

function getQueueSize() {
  return queue.length;
}

module.exports = {
  enqueueJob,
  processQueue,
  getQueueSize
};
