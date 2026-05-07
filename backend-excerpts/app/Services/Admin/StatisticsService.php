<?php

namespace App\Services\Admin;

use App\Models\Order;
use App\Models\Product;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use App\Enums\OrderStatusEnum;

class StatisticsService
{
    public function getOverviewData(): array
    {
        $startOfMonth = Carbon::now()->startOfMonth();
        $endOfMonth = Carbon::now()->endOfMonth();

        $orderKpis = Order::selectRaw('
            COUNT(CASE WHEN status = ? AND finalized_at BETWEEN ? AND ? THEN 1 END) as completed_this_month,
            COUNT(CASE WHEN status = ? AND finalized_at BETWEEN ? AND ? THEN 1 END) as cancelled_this_month,
            COUNT(CASE WHEN status = ? THEN 1 END) as pending_orders
        ', [
            OrderStatusEnum::DELIVERED->value, $startOfMonth, $endOfMonth, 
            OrderStatusEnum::CANCELLED->value, $startOfMonth, $endOfMonth,
            OrderStatusEnum::PENDING->value
        ])->first();

        return [
            'kpis' => [
                'completed_this_month' => $orderKpis->completed_this_month ?? 0,
                'cancelled_this_month' => $orderKpis->cancelled_this_month ?? 0,
                'pending_orders'       => $orderKpis->pending_orders ?? 0,
                'total_products'       => Product::count(),
            ],
            'charts' => $this->getOverviewChartsData()
        ];
    }

    private function getOverviewChartsData(): array
    {
        $startDate = Carbon::now()->subDays(6)->startOfDay();
        $endDate = Carbon::now()->endOfDay();

        $successfulArray = [];
        $unsuccessfulArray = [];
        
        for ($date = $startDate->copy(); $date->lte($endDate); $date->addDay()) {
            $formattedDate = $date->format('Y-m-d');
            $successfulArray[$formattedDate] = 0;
            $unsuccessfulArray[$formattedDate] = 0;
        }

        $successful = Order::select(DB::raw('DATE(finalized_at) as date'), DB::raw('COUNT(*) as count'))
            ->where('status', OrderStatusEnum::DELIVERED->value) 
            ->whereBetween('finalized_at', [$startDate, $endDate])
            ->groupBy('date')
            ->get();

        $unsuccessful = Order::select(DB::raw('DATE(finalized_at) as date'), DB::raw('COUNT(*) as count'))
            ->where('status', OrderStatusEnum::CANCELLED->value)
            ->whereBetween('finalized_at', [$startDate, $endDate])
            ->groupBy('date')
            ->get();
        foreach ($successful as $item) {
            if (isset($successfulArray[$item->date])) {
                $successfulArray[$item->date] = $item->count;
            }
        }

        foreach ($unsuccessful as $item) {
            if (isset($unsuccessfulArray[$item->date])) {
                $unsuccessfulArray[$item->date] = $item->count;
            }
        }

        return [
            'start_date'   => $startDate->toIso8601String(),
            'end_date'     => $endDate->toIso8601String(),
            'successful'   => $successfulArray,
            'unsuccessful' => $unsuccessfulArray,
        ];
    }

    public function getAdvancedData(Carbon $startDate, Carbon $endDate): array
    {
        $orderStats = Order::whereBetween('created_at', [$startDate, $endDate])
        ->selectRaw('
            COUNT(*) as total_orders,
            SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as pending_orders,
            SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as cancelled_orders,
            SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as successful_orders
        ', [
            OrderStatusEnum::PENDING->value,
            OrderStatusEnum::CANCELLED->value,
            OrderStatusEnum::DELIVERED->value 
        ])->first();

        $moneyStats = DB::table('order_items')
        ->join('orders', 'order_items.order_id', '=', 'orders.id')
        ->whereBetween('orders.created_at', [$startDate, $endDate])
        ->where('orders.status', OrderStatusEnum::DELIVERED->value)
        ->selectRaw('
            SUM(order_items.quantity) as total_sold,
            SUM(order_items.total) as total_revenue, 
            SUM(order_items.unit_cost_price * order_items.quantity) as total_cost,
            SUM(order_items.total - (order_items.unit_cost_price * order_items.quantity)) as net_profit 
        ')->first();

        return [
            'start_date'        => $startDate->toIso8601String(),
            'end_date'          => $endDate->toIso8601String(),
            'total_orders'      => (int) ($orderStats->total_orders ?? 0),
            'pending_orders'    => (int) ($orderStats->pending_orders ?? 0),
            'cancelled_orders'  => (int) ($orderStats->cancelled_orders ?? 0),
            'successful_orders' => (int) ($orderStats->successful_orders ?? 0),
            
            'total_revenue'     => (float) (($moneyStats->total_revenue ?? 0) / 100),
            'total_cost'        => (float) (($moneyStats->total_cost ?? 0) / 100),
            'net_profit'        => (float) (($moneyStats->net_profit ?? 0) / 100),
            'sold_products'     => (int) ($moneyStats->total_sold ?? 0),
        ];
    }

    public function getProductsData(): array
    {
        $startOfWeek = Carbon::now()->startOfWeek();
        $endOfWeek = Carbon::now()->endOfWeek();
        $startOfDay = Carbon::now()->startOfDay();
        $endOfDay = Carbon::now()->endOfDay();

        $stats = Product::selectRaw('
            COUNT(CASE WHEN created_at BETWEEN ? AND ? THEN 1 END) as this_week,
            COUNT(CASE WHEN created_at BETWEEN ? AND ? THEN 1 END) as today,
            COUNT(*) as total
        ', [$startOfWeek, $endOfWeek, $startOfDay, $endOfDay])->first();

        return [
            'this_week' => $stats->this_week ?? 0,
            'today'     => $stats->today ?? 0,
            'total'     => $stats->total ?? 0,
        ];
    }

    public function getOrdersData(): array
    {
        $startOfWeek = Carbon::now()->startOfWeek();
        $endOfWeek = Carbon::now()->endOfWeek();
        $startOfDay = Carbon::now()->startOfDay();
        $endOfDay = Carbon::now()->endOfDay();

        $stats = Order::selectRaw('
            COUNT(CASE WHEN created_at BETWEEN ? AND ? THEN 1 END) as today,
            COUNT(CASE WHEN status = ? AND finalized_at BETWEEN ? AND ? THEN 1 END) as successful_week,
            COUNT(CASE WHEN status = ? AND finalized_at BETWEEN ? AND ? THEN 1 END) as cancelled_week
        ', [
            $startOfDay, $endOfDay, 
            OrderStatusEnum::DELIVERED->value, $startOfWeek, $endOfWeek,
            OrderStatusEnum::CANCELLED->value, $startOfWeek, $endOfWeek
        ])->first();

        return [
            'today'           => $stats->today ?? 0,
            'successful_week' => $stats->successful_week ?? 0,
            'cancelled_week'  => $stats->cancelled_week ?? 0,
        ];
    }
}