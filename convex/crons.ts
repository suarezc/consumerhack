import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.daily("morning question", { hourUTC: 6, minuteUTC: 0 }, internal.lifecycle.morning, {});
export default crons;
