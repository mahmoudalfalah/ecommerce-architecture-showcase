import {
  type ColumnDef,
  type OnChangeFn,
  type Row,
  type RowData,
  type RowSelectionState,
} from '@tanstack/react-table';


import type { ReactNode } from 'react';


declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    skeleton?: () => ReactNode;
  }
}

export type WithId = { id: string | number };

export type DataTableProps<TData extends WithId, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  isFetching?: boolean;
  rowSelection?: RowSelectionState;
  setRowSelection?: OnChangeFn<RowSelectionState>;
  enableRowSelection?: (row: Row<TData>) => boolean;
  onRowClick?: (row: TData) => void;
  emptyKeyword?: string;
};
