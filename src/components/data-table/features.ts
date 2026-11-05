import { columnVisibilityFeature, createColumnHelper, metaHelper, tableFeatures, type RowData } from "@tanstack/react-table";

export type DataTableColumnMeta = {
  /** URL sort key; when set the header becomes a sort toggle. */
  sortKey?: string;
  /** Label used in the column visibility menu. */
  label?: string;
  headerClassName?: string;
  cellClassName?: string;
};

export const dataTableFeatures = tableFeatures({
  columnVisibilityFeature,
  columnMeta: metaHelper<DataTableColumnMeta>(),
});
export type DataTableFeatures = typeof dataTableFeatures;

export const createDataTableColumns = <T extends RowData>() => createColumnHelper<DataTableFeatures, T>();
