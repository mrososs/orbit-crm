import { Activity } from '../models';
import { addDays, startOfDay } from '../../shared/utils/date';

export type ActivityBucket = 'overdue' | 'today' | 'upcoming' | 'later' | 'completed';

export const ACTIVITY_BUCKETS: readonly ActivityBucket[] = ['overdue', 'today', 'upcoming', 'later', 'completed'];

/** Days ahead that count as "upcoming" (after today). */
export const UPCOMING_WINDOW_DAYS = 7;

/** Overdue is evaluated per calendar day: a task due earlier today is not overdue yet. */
export function isActivityOverdue(activity: Pick<Activity, 'dueAt' | 'completedAt'>, now: Date): boolean {
  return activity.completedAt === null && new Date(activity.dueAt) < startOfDay(now);
}

export function activityBucket(activity: Pick<Activity, 'dueAt' | 'completedAt'>, now: Date): ActivityBucket {
  if (activity.completedAt !== null) return 'completed';
  const due = new Date(activity.dueAt);
  const today = startOfDay(now);
  if (due < today) return 'overdue';
  if (due < addDays(today, 1)) return 'today';
  if (due < addDays(today, UPCOMING_WINDOW_DAYS + 1)) return 'upcoming';
  return 'later';
}

export function completionChange(activity: Activity, completed: boolean, now: Date): Partial<Activity> {
  const timestamp = now.toISOString();
  return { completedAt: completed ? timestamp : null, updatedAt: timestamp };
}
