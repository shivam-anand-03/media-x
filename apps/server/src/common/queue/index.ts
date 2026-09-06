// Importing a queue module instantiates it, which self-registers it with the
// QueueManager (see BaseQueueService). Adding a queue means adding a line here.
import "./email.queue";
import "./render.queue";
import "./asset.queue";

export {
  queueManager,
  startAllQueueWorkers,
  stopAllWorkers,
} from "./queue-manager";
