"use server";

import { refresh } from "next/cache";
import { Types } from "mongoose";
import { connectDB } from "@/server/db/connect";
import { Expense } from "@/server/db/models/expense";
import { ExpenseCategory } from "@/server/db/models/expense-category";
import { Client } from "@/server/db/models/client";
import { authorize } from "@/server/auth/dal";
import { audit, diff } from "@/server/services/audit";
import { getFx } from "@/server/services/fx";
import { AppError } from "@/server/errors";
import { parse, runAction } from "@/server/action";
import { amountToMinor, dayToDate, idOrNull } from "@/lib/fields";
import { formatMoney } from "@/lib/money";
import type { ActionResult } from "@/lib/action-result";
import { categorySchema, expenseSchema, type CategoryInput, type ExpenseInput } from "./schemas";

export async function saveExpenseAction(input: ExpenseInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await authorize("expenses.manage");
    const data = parse(expenseSchema, input);
    await connectDB();
    if (!(await ExpenseCategory.exists({ _id: data.categoryId }))) {
      throw new AppError("VALIDATION", "That category no longer exists.", { categoryId: ["Select a category."] });
    }
    if (data.clientId && !(await Client.exists({ _id: data.clientId, deletedAt: null }))) {
      throw new AppError("VALIDATION", "That client no longer exists.", { clientId: ["Select another client."] });
    }
    const amount = amountToMinor(data.amount)!;
    const fields = {
      name: data.name, categoryId: data.categoryId, amount, currency: data.currency, expenseDate: dayToDate(data.expenseDate)!,
      method: data.method, clientId: idOrNull(data.clientId), description: data.description, receiptRef: data.receiptRef,
      updatedBy: actor.id,
    };

    if (!data.id) {
      const { usdToLkr } = await getFx();
      const expense = await Expense.create({ ...fields, usdToLkr, createdBy: actor.id });
      await audit({ userId: actor.id, action: "create", module: "expenses", recordId: String(expense._id), summary: `Recorded expense “${data.name}” ${formatMoney(amount, data.currency)}`, after: { amount, currency: data.currency } });
      refresh();
      return { id: String(expense._id) };
    }

    if (!Types.ObjectId.isValid(data.id)) throw new AppError("NOT_FOUND", "Expense not found.");
    const expense = await Expense.findOne({ _id: data.id, deletedAt: null });
    if (!expense) throw new AppError("NOT_FOUND", "Expense not found.");
    const before = { name: expense.name, amount: expense.amount, currency: expense.currency, categoryId: String(expense.categoryId), expenseDate: expense.expenseDate.toISOString() };
    // Keep the original rate unless the currency changes.
    if (expense.currency !== data.currency) expense.usdToLkr = (await getFx()).usdToLkr;
    expense.set(fields);
    await expense.save();
    const d = diff(before, { name: data.name, amount, currency: data.currency, categoryId: data.categoryId, expenseDate: fields.expenseDate.toISOString() });
    if (d.changed) await audit({ userId: actor.id, action: "update", module: "expenses", recordId: data.id, summary: `Updated expense “${data.name}”`, before: d.before, after: d.after });
    refresh();
    return { id: data.id };
  });
}

export async function deleteExpenseAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("expenses.manage");
    await connectDB();
    const expense = Types.ObjectId.isValid(id) ? await Expense.findOne({ _id: id, deletedAt: null }) : null;
    if (!expense) throw new AppError("NOT_FOUND", "Expense not found.");
    expense.set({ deletedAt: new Date(), updatedBy: actor.id });
    await expense.save();
    await audit({ userId: actor.id, action: "delete", module: "expenses", recordId: id, summary: `Deleted expense “${expense.name}” ${formatMoney(expense.amount, expense.currency)}`, before: { amount: expense.amount, currency: expense.currency } });
    refresh();
    return null;
  });
}

export async function saveCategoryAction(input: CategoryInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await authorize("expenses.manage");
    const data = parse(categorySchema, input);
    await connectDB();
    const clash = await ExpenseCategory.findOne({ name: data.name, ...(data.id ? { _id: { $ne: data.id } } : {}) })
      .collation({ locale: "en", strength: 2 }).lean();
    if (clash) throw new AppError("CONFLICT", "A category with this name already exists.", { name: ["Already exists."] });
    if (!data.id) {
      const cat = await ExpenseCategory.create({ name: data.name, isActive: data.isActive, createdBy: actor.id, updatedBy: actor.id });
      await audit({ userId: actor.id, action: "create", module: "expenses", recordId: String(cat._id), summary: `Created expense category ${data.name}` });
      refresh();
      return { id: String(cat._id) };
    }
    const cat = await ExpenseCategory.findById(data.id);
    if (!cat) throw new AppError("NOT_FOUND", "Category not found.");
    cat.set({ name: data.name, isActive: data.isActive, updatedBy: actor.id });
    await cat.save();
    await audit({ userId: actor.id, action: "update", module: "expenses", recordId: data.id, summary: `Updated expense category ${data.name}` });
    refresh();
    return { id: data.id };
  });
}
