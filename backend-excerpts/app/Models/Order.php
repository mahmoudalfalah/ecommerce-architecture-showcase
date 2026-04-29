<?php

namespace App\Models;

use App\Models\OrderItem;
use App\Models\District;
use App\Models\City;
use App\Models\ProductStatistic;
use Laravel\Scout\Searchable;
use Illuminate\Database\Eloquent\Builder;
use App\Core\Filters\QueryFilter;
use App\Enums\OrderStatusEnum;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use Searchable;

    public function toSearchableArray() {
        return [
            'id'             => $this->id,
            'customer_name'  => $this->customer_name,
            'order_number'   => $this->order_number,
            'customer_phone' => $this->customer_phone,
            'status'         => $this->status->value ?? $this->status, 
            'city_id'        => $this->city_id,
            'district_id'    => $this->district_id, 
            'created_at'     => $this->created_at,
        ];
    }

    public function searchableAs()
    {
        return 'orders';
    }

    protected $fillable = [
        'order_number',
        'customer_name',
        'customer_phone',
        'customer_email',
        'city_id',
        'district_id', 
        'address',
        'subtotal',    
        'total',       
        'status',      
        'notes',
        'quantity',
        'finalized_at',
    ];

    protected $casts = [
        'status' => OrderStatusEnum::class, 
        'finalized_at' => 'datetime',
    ];

    public function orderItems() {
        return $this->hasMany(OrderItem::class);
    }

    public function city() {
        return $this->belongsTo(City::class, 'city_id', 'id');
    }

    public function district() {
        return $this->belongsTo(District::class, 'district_id', 'id'); 
    }

    public function productStatistics() {
        return $this->hasMany(ProductStatistic::class);
    }

    public function scopeFilter(Builder $query, QueryFilter $filter): Builder {
        return $filter->apply($query);
    }
}