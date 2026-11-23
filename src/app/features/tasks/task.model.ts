export interface TaskItem {
  id: string;
  title: string;
  description: string;
  dueDate?: string | null;
  isCompleted: boolean;
  priority: number;
  userId: number;
  teamId?: string | null;
  assignedTo?: string;
}
