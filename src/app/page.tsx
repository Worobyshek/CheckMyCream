import { IngredientAnalysisForm } from "@/components/ingredient-analysis-form";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Check My Cream</p>
        <p className="hero-copy">

        </p>
      </section>

      <IngredientAnalysisForm />
    </main>
  );
}
