import { redirect } from "next/navigation";

/**
 * /dashboard — la vecchia dashboard mock è stata ritirata (run-05
 * prompt 1, blueprint B5/15): la home è Oggi. La rotta resta come
 * redirect perché segnalibri e abitudini atterrino bene. NON è più
 * protetta dal proxy (tolta da PROTECTED_PREFIXES al run-06): anche
 * un ospite col vecchio segnalibro atterra su "/", mai sul muro di
 * login. (Commento corretto al run-09 prompt 6: diceva il contrario.)
 */
export default function DashboardPage() {
  redirect("/");
}
