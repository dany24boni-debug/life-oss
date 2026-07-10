import { redirect } from "next/navigation";

/**
 * /dashboard — la vecchia dashboard mock è stata ritirata (run-05
 * prompt 1, blueprint B5/15): la home è Oggi. La rotta resta come
 * redirect perché segnalibri e abitudini atterrino bene; la protezione
 * del proxy resta com'era (gli ospiti finiscono su /login, come sempre
 * per le rotte legacy).
 */
export default function DashboardPage() {
  redirect("/");
}
