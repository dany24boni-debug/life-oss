import { TasksScreen } from "./tasks-screen";

// /tasks — il modulo Task vero (B2.1): schermata client sul port locale.
// Il server component resta solo per metadata e composizione.

export const metadata = { title: "Task — LifeOS" };

export default function TasksPage() {
  return <TasksScreen />;
}
