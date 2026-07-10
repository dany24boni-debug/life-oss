import { notFound } from "next/navigation";
import { Bricolage_Grotesque } from "next/font/google";
import { Showcase } from "./showcase";

// Ember UI playground — dev-only (same convention as /dev/components).
// This route is NEW: registering it required creating this folder only,
// no existing file was modified. The display font is bound here (and in
// future new-shell layouts) via the --font-em-display variable that
// ui/ember.css reads with a Geist fallback.

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-em-display",
});

export const metadata = {
  title: "Ember UI — playground",
};

export default function EmberPlaygroundPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return (
    <div className={display.variable}>
      <Showcase />
    </div>
  );
}
