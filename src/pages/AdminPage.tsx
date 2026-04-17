import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { subscribeToOrders, updateOrderStatus, Order, OrderStatus } from '../lib/data';
import { Package, Phone, MapPin, Calendar, CheckCircle, Truck, RefreshCcw, XCircle, Clock, LogOut, TrendingUp, BarChart3, Home, Download, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import * as XLSX from 'xlsx';

const STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  shipped: 'bg-purple-100 text-purple-800 border-purple-200',
  delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  returned: 'bg-red-100 text-red-800 border-red-200',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'جديد',
  confirmed: 'تم التأكيد',
  shipped: 'تم الإرسال',
  delivered: 'تم التوصيل',
  returned: 'روتور',
};

export default function AdminPageWrapper() {
  return (
    <AdminPage />
  );
}

function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const { logout } = useAuth();

  useEffect(() => {
    const unsubscribe = subscribeToOrders((data) => {
      setOrders(data || []);
    });
    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (id: string, newStatus: OrderStatus) => {
    try {
      await updateOrderStatus(id, newStatus);
      toast.success('تم تحديث حالة الطلب');
    } catch (error) {
      toast.error('فشل تحديث حالة الطلب');
    }
  };

  const filteredOrders = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  const exportToExcel = () => {
    const confirmedOrders = orders.filter(o => o.status === 'confirmed');
    
    if (confirmedOrders.length === 0) {
      toast.error('لا توجد طلبيات مؤكدة لتنزيلها');
      return;
    }

    const data = confirmedOrders.map(order => ({
      'الاسم واللقب': order.customerName,
      'رقم الهاتف': order.phone,
      'الولاية': order.wilaya,
      'البلدية': order.commune,
      'العنوان': order.address || '',
      'نوع التوصيل': order.deliveryMethod === 'office' ? 'مكتب' : 'منزل',
      'العرض': order.offer,
      'الخيارات': order.flavor || '',
      'السعر الإجمالي': order.totalPrice,
      'التاريخ': new Date(order.date).toLocaleDateString('en-GB'),
      'الوقت': new Date(order.date).toLocaleTimeString('en-GB')
    }));

    const worksheet = XLSX.utils.json_to_sheet(data, { header: undefined });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "الطلبيات المؤكدة");
    
    // Auto-size columns
    const max_width = data.reduce((w, r) => Math.max(w, ...Object.values(r).map(v => v ? v.toString().length : 0)), 10);
    worksheet["!cols"] = Object.keys(data[0]).map(() => ({ wch: max_width + 5 }));

    XLSX.writeFile(workbook, `طلبيات_مؤكدة_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`);
    toast.success('تم تحميل ملف Excel بنجاح');
  };

  const totalRevenue = orders.filter(o => o.status === 'delivered').reduce((acc, curr) => acc + curr.totalPrice, 0);

  const chartData = useMemo(() => {
    const statusCounts = (Object.keys(STATUS_LABELS) as OrderStatus[]).map(status => ({
      name: STATUS_LABELS[status],
      count: orders.filter(o => o.status === status).length,
      color: status === 'delivered' ? '#10b981' : status === 'returned' ? '#ef4444' : '#6366f1'
    }));
    return statusCounts;
  }, [orders]);

  const revenueData = useMemo(() => {
    const dailyRevenue: Record<string, number> = {};
    orders.filter(o => o.status === 'delivered').forEach(order => {
      const date = new Date(order.date).toLocaleDateString('en-GB');
      dailyRevenue[date] = (dailyRevenue[date] || 0) + order.totalPrice;
    });
    return Object.entries(dailyRevenue).map(([date, revenue]) => ({ date, revenue })).reverse().slice(-7);
  }, [orders]);

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link to="/" className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-50 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600"><path d="m15 18-6-6 6-6"/></svg>
              </Link>
              <h1 className="text-3xl font-bold text-slate-900">لوحة التحكم</h1>
            </div>
            <p className="text-slate-500 mt-1">إدارة طلبيات K&K Store</p>
          </div>
          
          <div className="bg-white px-4 py-3 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-6 w-full lg:w-auto">
            <div className="flex items-center gap-4">
              <button onClick={logout} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors" title="تسجيل الخروج">
                <LogOut className="w-5 h-5" />
              </button>
              <div className="w-px h-6 bg-slate-200"></div>
              <Link to="/admin/products" className="text-sm font-bold text-slate-700 hover:text-rose-600 transition-colors flex items-center gap-2">
                <Package className="w-4 h-4" />
                إدارة المنتجات
              </Link>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">إجمالي الطلبات</p>
                <p className="text-xl font-black text-slate-900">{orders.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar flex-1">
            <button 
              onClick={() => setFilter('all')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap transition-all ${filter === 'all' ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
            >
              <span>الكل</span>
              <span className={`px-2 py-0.5 rounded-lg text-xs ${filter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {orders.length}
              </span>
            </button>
            {(Object.keys(STATUS_LABELS) as OrderStatus[]).map(status => {
              const count = orders.filter(o => o.status === status).length;
              return (
                <button 
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap transition-all border ${
                    filter === status 
                      ? `${STATUS_COLORS[status]} shadow-lg opacity-100` 
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>{STATUS_LABELS[status]}</span>
                  <span className={`px-2 py-0.5 rounded-lg text-xs ${
                    filter === status 
                      ? 'bg-white/60 text-current' 
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {filter === 'confirmed' && orders.filter(o => o.status === 'confirmed').length > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={exportToExcel}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4" />
              تنزيل Excel
            </motion.button>
          )}
        </div>

        {/* Orders Table/List */}
        <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
          <AnimatePresence mode="wait">
            {filteredOrders.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-20 text-center text-slate-400"
              >
                <Package className="w-16 h-16 mx-auto mb-4 opacity-10" />
                <p className="font-medium">لا توجد طلبيات حالياً في هذا القسم</p>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="overflow-x-auto"
              >
                <table className="w-full text-right whitespace-nowrap">
                  <thead className="bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">الزبون</th>
                      <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">الطلب</th>
                      <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">المبلغ</th>
                      <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">الحالة</th>
                      <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">إجراء</th>
                      <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredOrders.map(order => (
                      <motion.tr 
                        layout
                        key={order.id} 
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{order.customerName}</div>
                          <a href={`tel:${order.phone}`} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 mt-1 w-fit transition-colors font-medium">
                            <Phone className="w-3 h-3" />
                            <span dir="ltr">{order.phone}</span>
                          </a>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1 font-medium">
                            <MapPin className="w-3 h-3" />
                            <span>{order.wilaya} - {order.commune}</span>
                          </div>
                          {order.address && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1 font-medium">
                              <Home className="w-3 h-3" />
                              <span>{order.address}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-700 text-sm">
                            {order.offer === '1-pack' ? 'حبة واحدة' : 
                             order.offer === '2-pack' ? 'عرض ذهبي (2)' : 
                             order.offer === '4-pack' ? 'باقة كاملة (4)' : 
                             order.offer}
                          </div>
                          {order.flavor && (
                            <div className="text-[11px] text-slate-500 mt-1.5 flex flex-wrap gap-1.5">
                              {order.flavor.split(' + ').map((f, i) => {
                                const match = f.match(/^(\d+)x?\s+(.+)$/);
                                if (match) {
                                  return (
                                    <div key={i} className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                                      <span className="text-rose-600 font-black">{match[1]}</span>
                                      <span className="font-bold">{match[2]}</span>
                                    </div>
                                  );
                                }
                                return <div key={i} className="bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 font-bold">{f}</div>;
                              })}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-black text-slate-900">{order.totalPrice} دج</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold border ${STATUS_COLORS[order.status]}`}>
                            {STATUS_LABELS[order.status]}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <select 
                            value={order.status}
                            onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2 outline-none transition-all cursor-pointer hover:bg-white"
                          >
                            <option value="new">جديد</option>
                            <option value="confirmed">تم التأكيد</option>
                            <option value="shipped">تم الإرسال</option>
                            <option value="delivered">تم التوصيل</option>
                            <option value="returned">روتور</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 text-[10px] text-slate-400 font-bold">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span dir="ltr">{new Date(order.date).toLocaleDateString('en-GB')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span dir="ltr">{new Date(order.date).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
