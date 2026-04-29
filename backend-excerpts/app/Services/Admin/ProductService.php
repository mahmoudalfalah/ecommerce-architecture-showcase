<?php

namespace App\Services\Admin;

use App\Models\Product;
use App\Models\Category;
use App\Models\Brand;
use App\Filters\Admin\ProductFilter;
use App\Services\Admin\SlugService;
use Illuminate\Support\Str;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ProductService
{
    public function getFilteredProducts(array $validatedData, ProductFilter $filter): LengthAwarePaginator
    {
        $searchQuery = $validatedData['search'] ?? null;
        $perPage = $validatedData['per_page'] ?? 10;
    
        $queryCallback = function ($query) use ($filter) {
            $query->with(['category', 'brand'])->filter($filter);
            $filter->applyDefaultSorting();
        };

        if ($searchQuery) {
            try {
                return Product::search($searchQuery)
                    ->query($queryCallback)
                    ->paginate($perPage)
                    ->withQueryString();
            } catch (\Exception $e) {
                $query = Product::where('name', 'like', '%' . trim($searchQuery) . '%');
                $queryCallback($query);
                return $query->paginate($perPage)->withQueryString();
            }
        }

        $query = Product::query();
        $queryCallback($query);
        return $query->paginate($perPage)->withQueryString();
    }

    public function getProduct(int $id): ?Product
    {
        return Product::with('category', 'brand')->find($id);
    }

    public function storeProduct(array $data, ?array $newFiles = []): Product
    {
        $imagesPaths = [];
        if (!empty($newFiles)) {
            foreach ($newFiles as $file) {
                $imagesPaths[] = $file->store('products/images', 'public');
            }
        }

        $data['images'] = array_values($imagesPaths);
        $data['cost_price']   = (int) round((float) $data['cost_price'] * 100);
        $data['retail_price'] = (int) round((float) $data['retail_price'] * 100);
        $data['discount']     = isset($data['discount']) ? (int) round((float) $data['discount'] * 100) : null;
        $data['slug']         = SlugService::generateUniqueSlug(Product::class, $data['name']);

        return DB::transaction(function () use ($data) {
            $product = Product::create($data);
            Category::where('id', $data['category_id'])->increment('products_total');
            Brand::where('id', $data['brand_id'])->increment('products_total');
            return $product;
        });
    }

    public function updateProduct(int $id, array $data, ?array $newFiles = []): Product
    {
        return DB::transaction(function () use ($id, $data, $newFiles) {
            $product = Product::findOrFail($id);

            $rawOldImages = $data['old_images'] ?? [];
            $oldImages = array_map(fn($img) => ltrim($img, '/'), $rawOldImages);
            
            $serverImages = $product->images ?? [];
            $deletedImages = array_diff($serverImages, $oldImages);

            foreach ($deletedImages as $img) {
                if (!empty($img) && Storage::disk('public')->exists($img)) {
                    Storage::disk('public')->delete($img);
                }
            }

            $imagesPaths = $oldImages;
            if (!empty($newFiles)) {
                foreach ($newFiles as $file) {
                    $imagesPaths[] = $file->store('products/images', 'public');
                }
            }

            $data['images'] = array_values($imagesPaths);
            $data['cost_price']   = (int) round((float) $data['cost_price'] * 100);
            $data['retail_price'] = (int) round((float) $data['retail_price'] * 100);
            $data['discount']     = isset($data['discount']) ? (int) round((float) $data['discount'] * 100) : null;

            if (isset($data['category_id']) && (int) $data['category_id'] !== $product->category_id) {
                Category::where('id', $product->category_id)->decrement('products_total');
                Category::where('id', $data['category_id'])->increment('products_total');
            }

            if (isset($data['brand_id']) && (int) $data['brand_id'] !== $product->brand_id) {
                Brand::where('id', $product->brand_id)->decrement('products_total');
                Brand::where('id', $data['brand_id'])->increment('products_total');
            }

            $product->update($data);
            return $product;
        });
    }

    public function deleteProducts(array $ids): int
    {
        return DB::transaction(function () use ($ids) {
            $products = Product::whereIn('id', $ids)->get();
            $deletedCount = 0;
            $imagesToDelete = [];
            $categoryDecrements = [];
            $brandDecrements = [];

            foreach ($products as $product) {
                if (is_array($product->images)) {
                    $imagesToDelete = array_merge($imagesToDelete, $product->images);
                }

                if ($product->category_id) {
                    $categoryDecrements[$product->category_id] = ($categoryDecrements[$product->category_id] ?? 0) + 1;
                }

                if ($product->brand_id) {
                    $brandDecrements[$product->brand_id] = ($brandDecrements[$product->brand_id] ?? 0) + 1;
                }
                $deletedCount++;
            }

            foreach (array_unique($imagesToDelete) as $img) {
                if (!empty($img) && Storage::disk('public')->exists($img)) {
                    Storage::disk('public')->delete($img);
                }
            }

            foreach ($categoryDecrements as $categoryId => $count) {
                Category::where('id', $categoryId)->decrement('products_total', $count);
            }

            foreach ($brandDecrements as $brandId => $count) {
                Brand::where('id', $brandId)->decrement('products_total', $count);
            }

            Product::whereIn('id', $ids)->delete();
            return $deletedCount;
        });
    }

    public function toggleVisibility(int $id): bool
    {
        $product = Product::findOrFail($id);
        $product->is_visible = !$product->is_visible;
        $product->save(); 
        return $product->is_visible;
    }
}