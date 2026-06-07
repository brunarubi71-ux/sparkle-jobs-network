export const TRANSPORT_FEE = 20; // $20 car/transport allowance per cleaner on team jobs

/**
 * Returns the worker's net earnings for a job.
 * - Solo jobs: equal split of 90% pool among all workers
 * - Team jobs (has helpers): each cleaner gets a transport bonus + equal share of remainder
 *                             helpers get equal share of remainder only
 *
 * Transport bonus is capped at 50% of the pool so helpers always receive something
 * even on low-price jobs with many cleaners.
 */
export function getWorkerShare(
  price: number,
  cleanersRequired: number,
  helpersRequired: number,
  workerType: "cleaner" | "helper"
): number {
  const pool = price * 0.9;
  const totalWorkers = Math.max(1, cleanersRequired + helpersRequired);

  if (helpersRequired === 0 || cleanersRequired === 0) {
    // No mixed team — equal split
    return pool / totalWorkers;
  }

  // Mixed team: cleaners get transport bonus, capped so helpers always earn > 0
  const rawTransportTotal = TRANSPORT_FEE * cleanersRequired;
  const transportTotal = Math.min(rawTransportTotal, pool * 0.5);
  const transportPerCleaner = transportTotal / cleanersRequired;
  const remainder = pool - transportTotal;
  const perWorker = remainder / totalWorkers;

  return workerType === "cleaner" ? transportPerCleaner + perWorker : perWorker;
}
