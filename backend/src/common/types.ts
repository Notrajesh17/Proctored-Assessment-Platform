export type Role = 'admin' | 'candidate';

export type QuestionType = 'single_choice' | 'multiple_choice' | 'short_answer';

export type AttemptStatus = 'in_progress' | 'submitted' | 'auto_submitted';

export type ProctorEventType =
  | 'tab_switch'
  | 'window_blur'
  | 'fullscreen_exit'
  | 'copy'
  | 'paste'
  | 'right_click';

export interface AuthUser {
  sub: string;
  email: string;
  role: Role;
  name: string;
}
