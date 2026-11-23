export interface ChatMessage {
  id?: string;
  sender: string;
  receiver: string;
  text: string;
  timestamp: string;
  createdAt?: number;
  isRead?: boolean;
  notificationRead?: boolean;
}
