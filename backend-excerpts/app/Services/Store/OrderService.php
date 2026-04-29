<?php

namespace App\Services\Store;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Services\Shared\OrderNumberService;
use App\Enums\OrderStatusEnum;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class OrderService
{
    public function placeOrder(array $data): array
    {
        return DB::transaction(function () use ($data) {
            $products = $data['products'];
            $itemsToInsert = [];
            $totalPrice = 0;
            $totalQuantity = 0;

            $productIds = collect($products)->pluck('product_id')->sort()->values()->toArray();

            $dbProducts = Product::whereIn('id', $productIds)
                ->where('is_visible', true)
                ->lockForUpdate()
                ->get()
                ->keyBy('id'); 

            $now = now(); 

            foreach ($products as $product) {
                $productId = $product['product_id']; 
                $quantity = $product['quantity'];

                if (!$dbProducts->has($productId)) {
                    throw new InvalidArgumentException("ERR_PRODUCT_UNAVAILABLE");
                }

                $selectedProduct = $dbProducts->get($productId);

                if ($selectedProduct->stock < $quantity) {
                    throw new InvalidArgumentException("ERR_INSUFFICIENT_STOCK");
                }

                $realBasePrice = (int) $selectedProduct->cost_price;
                $sellBasePrice = (int) $selectedProduct->retail_price;
                
                $discountValue = (int) ($selectedProduct->discount ?? 0);
                $finalPrice = max(0, $sellBasePrice - $discountValue);

                $itemsToInsert[] = [
                    'product_id'            => $productId,
                    'product_name_snapshot' => $selectedProduct->name,
                    'product_sku_snapshot'  => $selectedProduct->sku,
                    'quantity'              => $quantity,
                    'unit_retail_price'     => $sellBasePrice, 
                    'unit_cost_price'       => $realBasePrice,
                    'unit_discount'         => $discountValue,
                    'total'                 => $finalPrice * $quantity, 
                    'created_at'            => $now, 
                    'updated_at'            => $now,
                ];

                $totalPrice += $finalPrice * $quantity;
                $totalQuantity += $quantity;
                
                $selectedProduct->decrement('stock', $quantity);
            }

            $orderData = [
                'customer_name'          => $data['customer_name'],
                'customer_phone'         => $data['customer_phone'],
                'customer_email'         => $data['customer_email'] ?? null,
                
                'city_id'                => $data['city_id'],
                'district_id'            => $data['district_id'],
                'address'                => $data['address'],
                
                'status'                 => OrderStatusEnum::PENDING->value, 
                
                'subtotal'               => $totalPrice, 
                'quantity'               => $totalQuantity,
                'total'                  => $totalPrice, 
                'notes'                  => $data['notes'] ?? null,
                'order_number'           => OrderNumberService::generate(),
            ];

            $newOrder = Order::create($orderData);

            foreach ($itemsToInsert as &$item) {
                $item['order_id'] = $newOrder->id;
            }
            
            OrderItem::insert($itemsToInsert);

            return [
                'order_id'     => $newOrder->id,
                'order_number' => $newOrder->order_number,
            ];
        });
    }
}