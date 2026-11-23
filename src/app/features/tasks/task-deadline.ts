import { TaskItem } from './task.model';

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isTaskOverdue(dueDate?: string | null): boolean {
  if (!dueDate) return false;
  const datePart = dueDate.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
  return endOfDay.getTime() < Date.now();
}

export function getUpcomingTasks(tasks: TaskItem[], today: Date) {
  const firstDay = formatDateKey(today);
  const lastDay = formatDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2));

  return tasks.flatMap(task => {
    const dueDate = task.dueDate?.split('T')[0];
    if (task.isCompleted || !dueDate || dueDate < firstDay || dueDate > lastDay) return [];
    return [{ ...task, dueDate }];
  }).sort((first, second) =>
    first.dueDate.localeCompare(second.dueDate) || second.priority - first.priority
  );
}
