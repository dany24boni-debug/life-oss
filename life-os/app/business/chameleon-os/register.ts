// Module registration — Chameleon OS.
//
// Chameleon OS è un modulo CONDIVISO (non privato): vive sia sul
// branch personal sia sul branch shared col socio. Per questo
// l'import side-effect è fatto direttamente in
// `lib/modules/index.ts` (entry pubblico) anziché in
// `private-boot.personal.ts`.
//
// Registrato via `registerModule` (NON `registerPrivateModule`):
// sul registry, la definition NON ha il flag `private: true`.

// IMPORTANT: importa da `@/lib/modules/registry` (file di basso
// livello), NON da `@/lib/modules` (entry barrel). Quest'ultimo
// fa side-effect import di QUESTO stesso register.ts → circular
// → `registerModule` è ancora undefined quando si esegue.
// Documentato nel lib/modules/README.md.
import { registerModule } from "@/lib/modules/registry";

registerModule({
  id: "chameleon_os",
  label: "Chameleon OS",
  emoji: "🦎",
  route: "/business/chameleon-os",
  tabOrder: 30,
  businessTab: true,
  dashboardWidget: false,

  /**
   * Overseer system-prompt slot. Neutralizzata in S4 (scrub
   * testuale): pre-S4 era "- Chameleon OS: content fino giugno,
   * full-time lug-ago." — info temporal-specific personale (mesi
   * di transizione). Post-S4 è la dimensione invariante del
   * progetto: dev partnership; la fase corrente (content vs
   * full-time) la legge l'AI dai goal/target nel context block.
   *
   * Future: timing info (fase, mese di switch) può vivere in
   * `user_long_term_goals` (testo libero) o un settings field
   * dedicato; il consumer userà il context block "Why Panel"
   * che già esiste in lib/overseer/context.ts userContext.
   */
  overseerContext({ isActive }) {
    if (!isActive) return "";
    return "- Chameleon OS: progetto dev in partnership — vedi goal e target nel context.";
  },

  // Nessun taskGenerator per ora — pre-S2 nemmeno generator.ts
  // contribuiva task per chameleon_os negli state hardcoded.
  // Se in V2 vogliamo che Chameleon contribuisca a Scaling /
  // Manutenzione, aggiungere qui il hook.
});
