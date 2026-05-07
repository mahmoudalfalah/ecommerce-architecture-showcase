import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { clsx } from 'clsx';
import { AnimatePresence, type Variants, motion } from 'framer-motion';

import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';

import { tableBodyVariants, tableRowVariants } from '@/configs/table-animations.configs';

import { SKELETON_ROW_COUNT } from './dataTable.configs';
import { type DataTableProps, type WithId } from './data-table.types';

import styles from './DataTable.module.css';

export function DataTable<TData extends WithId, TValue>({
  columns,
  data,
  isLoading,
  isFetching,
  rowSelection,
  setRowSelection,
  enableRowSelection,
  onRowClick,
  emptyKeyword = 'data',
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data: data,
    columns,
    state: { rowSelection: rowSelection || {} },
    enableRowSelection: enableRowSelection,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
  });

  return (
    <div className={styles.wrapper}>
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.table
            key="loading"
            className={styles.table}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
          >
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className={styles.headRow}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className={styles.headCell}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <motion.tbody variants={tableBodyVariants} initial="hidden" animate="show" exit="exit">
              {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
                <motion.tr key={`skeleton-${index}`} variants={tableRowVariants}>
                  {table.getVisibleLeafColumns().map((col) => {
                    const customSkeleton = col.columnDef.meta?.skeleton;
                    return (
                      <td key={`skeleton-col-${col.id}`} className={styles.cell}>
                        {customSkeleton ? (
                          customSkeleton()
                        ) : (
                          <Skeleton variant="text" width="80%" />
                        )}
                      </td>
                    );
                  })}
                </motion.tr>
              ))}
            </motion.tbody>
          </motion.table>
        ) : data.length > 0 ? (
          <motion.div
            key="data"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AnimatePresence>
              {isFetching && (
                <motion.div
                  key="fetching-overlay"
                  className={styles.fetchingOverlay}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              )}
            </AnimatePresence>

            <table className={styles.table}>
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className={styles.headRow}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className={styles.headCell}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>

              <motion.tbody
                variants={tableBodyVariants}
                initial="hidden"
                animate="show"
                exit="exit"
              >
                {table.getRowModel().rows.map((row) => (
                  <motion.tr
                    key={row.id}
                    variants={tableRowVariants}
                    className={clsx(styles.dataRow, row.getIsSelected() && styles.selected)}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className={styles.cell}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <EmptyState keyword={emptyKeyword} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
