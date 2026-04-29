import React from 'react';
import type { Row } from '@tanstack/react-table';
import type { Order } from '../../../types/order.types';

import { ChangeOrderStatusModal } from '../../../components/admin/ChangeOrderStatusModal/ChangeOrderStatusModal';
import { DataTable } from '@/components/shared/DataTable/DataTable';
import { DebouncedSearchInput } from '@/components/shared/DebouncedSearchInput/DebouncedSearchInput';
import { ActionsToolbar } from '@/components/ui/ActionsToolbar/ActionsToolbar';
import { Button } from '@/components/ui/Button/Button';
import { Select } from '@/components/ui/Select/Select';
import { StatsBoard } from '@/components/ui/StatsBoard/StatsBoard';
import { TablePagination } from '@/components/ui/TablePagination/TablePagination';

import { useOrdersManagement } from '../../../hooks/admin/useOrdersManagement';

import { ORDERS_STATS_CONFIGS } from '../../../configs/orders-stats.configs';
import { UNSELECTABLE_STATUSES } from '../../../configs/orders.configs';

import styles from './OrdersManagementPage.module.css';

const OrdersManagementPage: React.FC = () => {
  const { state, data, loadingState, actions, controls } = useOrdersManagement();

  return (
    <>
      <main className={styles.main}>
        <StatsBoard
          configs={ORDERS_STATS_CONFIGS}
          data={data.statsData}
          isLoading={loadingState.isLoadingStats}
        />

        <ActionsToolbar
          search={
            <DebouncedSearchInput
              onSearch={actions.setSearchKeyword}
              placeholder="Search by order number or customer name"
              delay={400}
            />
          }
          actions={
            <div className={styles.actions}>
              <div className={styles.selectWrapper}>
                <Select
                  data={data.orderStatuses || []}
                  control={controls.statusControl}
                  name="status_filter"
                  label="Filter by status"
                  noFieldLabel={true}
                  noMargin={true}
                />
              </div>
              <Button onClick={actions.handleChangeStatusRequest}>Change Status</Button>
            </div>
          }
        />

        <DataTable
          columns={data.columns}
          data={data.orders}
          isLoading={loadingState.isLoadingOrders}
          isFetching={loadingState.isFetchingOrders}
          rowSelection={state.rowSelection}
          setRowSelection={actions.setRowSelection}
          enableRowSelection={(row: Row<Order>) => !UNSELECTABLE_STATUSES.includes(row.original.status_code)}
          onRowClick={(row: Order) => actions.goToOrderDetails(String(row.id))}
          emptyKeyword="Orders"
        />

        {data.paginationData && (
          <TablePagination
            data={data.paginationData}
            setPageNumber={actions.setPageNumber}
            pageNumber={state.filters.pageNumber}
          />
        )}
      </main>

      <ChangeOrderStatusModal
        isOpen={state.activeModal.type === 'changeStatus'}
        onClose={actions.closeModal}
        onAction={actions.handleChangeStatusConfirm}
        isLoading={loadingState.isUpdatingStatus}
        selectedOrdersStatuses={state.activeModal.payload ?? []}
        orderStatuses={data.orderStatuses?.filter((status) => status.id !== 'all') || []}
      />
    </>
  );
};

export default OrdersManagementPage;
