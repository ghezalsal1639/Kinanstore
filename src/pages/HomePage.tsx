import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getProducts, Product } from '../lib/data';
import { Package } from 'lucide-react';

export default function HomePage() {
  const [firstProductId, setFirstProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFirstProduct = async () => {
      try {
        const products = await getProducts();
        if (products && products.length > 0) {
          setFirstProductId(products[0].id);
        }
      } catch (error) {
        console.error("Error fetching products for home redirect:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFirstProduct();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600"></div>
      </div>
    );
  }

  if (firstProductId) {
    return <Navigate to={`/p/${firstProductId}`} replace />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
      <Package className="w-16 h-16 text-slate-300 mb-4" />
      <h1 className="text-2xl font-bold text-slate-900 mb-2">مرحباً بك في KINAN STORE</h1>
      <p className="text-slate-500 mb-6">لا توجد منتجات معروضة حالياً. يرجى العودة لاحقاً.</p>
      <a 
        href="/admin" 
        className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
      >
        لوحة التحكم
      </a>
    </div>
  );
}
