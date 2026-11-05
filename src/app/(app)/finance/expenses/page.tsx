import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { can, requireUser } from "@/server/auth/dal";
import { listCategories, listExpenses } from "@/features/expenses/queries";
import { getClientOptionsForFinance } from "@/features/invoices/queries";
import { ExpensesView } from "@/features/expenses/components/expenses-view";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!can(user, "expenses.view")) return <AccessDenied />;
  const sp = await searchParams;
  const [data, categories, clients] = await Promise.all([listExpenses(sp), listCategories(), getClientOptionsForFinance()]);
  return (
    <PageContainer>
      <ExpensesView
        data={data}
        totalBase={data.totalBase}
        base={data.base}
        categories={categories}
        options={{ categories: categories.map((c) => ({ value: c.id, label: c.name, active: c.isActive })), clients }}
      />
    </PageContainer>
  );
}
