import React, { useState, useEffect } from 'react';
import { ShieldCheck, Package, Truck, Star, CheckCircle2, Lock, ChevronDown, X, Sparkles, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { WILAYAS, saveOrder, getProduct, Product } from '../lib/data';

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [activeImage, setActiveImage] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  const [offers, setOffers] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [variantType, setVariantType] = useState<'colors' | 'sizes' | 'none'>('none');
  const [variantNameDisplay, setVariantNameDisplay] = useState('الخيار');

  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    wilaya: '',
    commune: '',
    offer: '1-pack',
    selectedVariants: {} as Record<string, number>,
  });

  useEffect(() => {
    const fetchProductData = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      
      const fetchedProduct = await getProduct(id);
      if (fetchedProduct) {
        setProduct(fetchedProduct);
        
        // Generate offers based on price
        const price2 = fetchedProduct.offer2Price || (fetchedProduct.price * 2);
        const price4 = fetchedProduct.offer4Price || (fetchedProduct.price * 4);
        const oldPrice1 = fetchedProduct.oldPrice || Math.round(fetchedProduct.price * 1.3);
        const oldPrice2 = fetchedProduct.offer2Price ? Math.round(fetchedProduct.offer2Price * 1.3) : oldPrice1 * 2;
        const oldPrice4 = fetchedProduct.offer4Price ? Math.round(fetchedProduct.offer4Price * 1.3) : oldPrice1 * 4;

        const generatedOffers = [
          { id: '1-pack', title: 'حبة واحدة', price: fetchedProduct.price, oldPrice: oldPrice1, desc: 'اختر ما يناسبك', popular: false, count: 1 },
          { id: '2-pack', title: 'العرض الذهبي (2 حبات)', price: price2, oldPrice: oldPrice2, desc: fetchedProduct.offer2Price ? 'توفير ممتاز' : 'حبتين', popular: true, count: 2 },
          { id: '4-pack', title: 'الباقة الكاملة (4 حبات)', price: price4, oldPrice: oldPrice4, desc: fetchedProduct.offer4Price ? 'سعر حصري جداً' : '4 حبات', popular: false, count: 4 },
        ];
        setOffers(generatedOffers);

        // Determine variants (colors or sizes)
        let newVariants: any[] = [];
        let vType: 'colors' | 'sizes' | 'none' = 'none';
        let vName = fetchedProduct.variantName || 'الخيار';
        
        if (fetchedProduct.variantOptions && fetchedProduct.variantOptions.length > 0) {
          vType = 'colors'; // using 'colors' as a generic flag for variants
          newVariants = fetchedProduct.variantOptions.map((v, i) => ({ id: `var-${i}`, name: v }));
        } else if (fetchedProduct.colors && fetchedProduct.colors.length > 0) {
          vType = 'colors';
          vName = 'اللون';
          newVariants = fetchedProduct.colors.map((c, i) => ({ id: `color-${i}`, name: c }));
        } else if (fetchedProduct.sizes && fetchedProduct.sizes.length > 0) {
          vType = 'sizes';
          vName = 'المقاس';
          newVariants = fetchedProduct.sizes.map((s, i) => ({ id: `size-${i}`, name: s }));
        }
        
        setVariants(newVariants);
        setVariantType(vType as any);
        // We will store vName in state to display it
        setVariantNameDisplay(vName);

        // Initialize selected variants
        const initialVariants: Record<string, number> = {};
        if (newVariants.length > 0) {
          newVariants.forEach(v => initialVariants[v.id] = 0);
          initialVariants[newVariants[0].id] = 1; // Select first by default
        }
        
        setFormData(prev => ({ ...prev, selectedVariants: initialVariants }));
      }
      setLoading(false);
    };

    fetchProductData();
  }, [id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600"></div></div>;
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <Package className="w-16 h-16 text-slate-300 mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">المنتج غير موجود</h1>
        <p className="text-slate-500 mb-6">عذراً، لم نتمكن من العثور على المنتج المطلوب.</p>
        <Link to="/" className="bg-rose-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-rose-700 transition-colors">
          العودة للرئيسية
        </Link>
      </div>
    );
  }

  const handleOfferChange = (offerId: string) => {
    const selectedOffer = offers.find(o => o.id === offerId);
    const count = selectedOffer ? selectedOffer.count : 1;
    
    let defaultVariants: Record<string, number> = {};
    if (variants.length > 0) {
      variants.forEach(v => defaultVariants[v.id] = 0);
      
      // Distribute count among available variants
      for (let i = 0; i < count; i++) {
        const variantIndex = i % variants.length;
        defaultVariants[variants[variantIndex].id]++;
      }
    }

    setFormData(prev => ({ 
      ...prev, 
      offer: offerId,
      selectedVariants: defaultVariants
    }));
  };

  const handleVariantChange = (variantId: string, delta: number) => {
    setFormData(prev => {
      const selectedOffer = offers.find(o => o.id === prev.offer);
      const maxCount = selectedOffer ? selectedOffer.count : 1;
      const currentTotal = Object.values(prev.selectedVariants).reduce((a: number, b: number) => a + b, 0) as number;
      const currentCount = prev.selectedVariants[variantId] || 0;

      if (delta > 0 && currentTotal >= maxCount) {
        return prev;
      }
      if (delta < 0 && currentCount <= 0) {
        return prev;
      }

      return {
        ...prev,
        selectedVariants: {
          ...prev.selectedVariants,
          [variantId]: currentCount + delta
        }
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName || !formData.phone || !formData.wilaya || !formData.commune) {
      toast.error('يرجى ملء جميع المعلومات');
      return;
    }

    const selectedOffer = offers.find(o => o.id === formData.offer);
    const maxCount = selectedOffer ? selectedOffer.count : 1;
    
    let variantNames = '';
    if (variants.length > 0) {
      const currentTotal = Object.values(formData.selectedVariants).reduce((a: number, b: number) => a + b, 0) as number;
      if (currentTotal !== maxCount) {
        toast.error(`يرجى اختيار ${maxCount} خيارات بالضبط`);
        return;
      }
      variantNames = Object.entries(formData.selectedVariants)
        .filter(([_, count]) => (count as number) > 0)
        .map(([vId, count]) => `${count}x ${variants.find(v => v.id === vId)?.name}`)
        .join(' + ');
    }
    
    try {
      await saveOrder({
        customerName: formData.customerName,
        phone: formData.phone,
        wilaya: formData.wilaya,
        commune: formData.commune,
        offer: `${product.name} - ${selectedOffer?.title}`,
        flavor: variantNames,
        totalPrice: selectedOffer?.price || product.price,
      });

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#e11d48', '#f43f5e', '#fb7185', '#ffffff']
      });

      setShowSuccessModal(true);

      // Reset form
      const initialVariants: Record<string, number> = {};
      if (variants.length > 0) {
        variants.forEach(v => initialVariants[v.id] = 0);
        initialVariants[variants[0].id] = 1;
      }

      setFormData({
        customerName: '',
        phone: '',
        wilaya: '',
        commune: '',
        offer: '1-pack',
        selectedVariants: initialVariants,
      });
      setActiveImage(0);
    } catch (err) {
      toast.error('حدث خطأ أثناء حفظ الطلب. يرجى المحاولة مرة أخرى.');
    }
  };

  const productImages = product.media && product.media.length > 0 
    ? product.media 
    : ["https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?q=80&w=800&auto=format&fit=crop"];

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Top Announcement Bar */}
      <div className="bg-rose-600 text-white text-center py-2 text-sm font-medium px-4">
        🔥 عرض محدود: اطلب الآن وادفع عند الاستلام!
      </div>

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-center">
          <span className="font-extrabold text-2xl tracking-tight text-slate-900">K&K Store</span>
        </div>
      </header>

      <main className="max-w-md mx-auto bg-white min-h-screen shadow-xl">
        {/* Product Image Gallery (Swipeable) */}
        <div className="relative w-full aspect-square bg-white border-b border-gray-100" dir="ltr">
          <div 
            className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar w-full h-full"
            onScroll={(e) => {
              const scrollLeft = e.currentTarget.scrollLeft;
              const width = e.currentTarget.clientWidth;
              setActiveImage(Math.round(scrollLeft / width));
            }}
          >
            {productImages.map((img, idx) => (
              <div key={idx} className="w-full h-full shrink-0 snap-center">
                {img.endsWith('.mp4') || img.endsWith('.webm') ? (
                  <video src={img} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                ) : (
                  <img 
                    src={img} 
                    alt={`${product.name} ${idx + 1}`} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
            ))}
          </div>
          
          {/* Dots Indicator */}
          {productImages.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
              {productImages.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    activeImage === idx ? 'bg-rose-600 w-6' : 'bg-white/80 w-2 shadow-sm'
                  }`} 
                />
              ))}
            </div>
          )}

          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full shadow-sm flex items-center gap-1" dir="rtl">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-sm font-bold text-slate-800">4.9</span>
          </div>
        </div>

        {/* Product Info */}
        <div className="p-5 border-b border-gray-100" dir="rtl">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-1 rounded-md">الأكثر مبيعاً</span>
            {product.isSecretPackaging && (
              <span className="flex items-center text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-md">
                <Lock className="w-3 h-3 ml-1" /> تغليف سري 100%
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2 leading-tight">
            {product.name}
          </h1>
          <div className="flex items-end gap-3 mb-4">
            <span className="text-3xl font-black text-rose-600">{product.price} <span className="text-lg">دج</span></span>
            {product.oldPrice && (
              <span className="text-lg text-slate-400 line-through mb-1">{product.oldPrice} دج</span>
            )}
          </div>
          <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap mb-6">
            {product.description || 'منتج عالي الجودة ومضمون. اطلب الآن واستفد من العرض.'}
          </p>

          {product.features && product.features.length > 0 && (
            <div className="bg-slate-50 rounded-2xl p-5 mb-2 mt-4">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-rose-500" />
                لماذا تختار هذا المنتج؟
              </h3>
              <ul className="space-y-3">
                {product.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <span className="text-slate-700 text-sm font-medium leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Trust Badges */}
        <div className="grid grid-cols-3 gap-2 p-5 bg-slate-50 border-b border-gray-100" dir="rtl">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-700">جودة مضمونة</span>
          </div>
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-blue-600">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-700">تغليف آمن</span>
          </div>
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-rose-600">
              <Truck className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-700">الدفع عند الاستلام</span>
          </div>
        </div>

        {/* Order Form Section */}
        <div id="order-form" className="p-5 pt-8" dir="rtl">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-rose-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
            <h2 className="text-xl font-black text-slate-900">اختر العرض المناسب</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Offers */}
            <div className="space-y-3">
              {offers.map((offer) => (
                <label 
                  key={offer.id}
                  className={`relative block p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    formData.offer === offer.id 
                      ? 'border-rose-600 bg-rose-50' 
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <input 
                    type="radio" 
                    name="offer" 
                    value={offer.id}
                    checked={formData.offer === offer.id}
                    onChange={() => handleOfferChange(offer.id)}
                    className="sr-only"
                  />
                  {offer.popular && (
                    <div className="absolute top-0 left-4 -translate-y-1/2 bg-rose-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                      الأكثر طلباً
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.offer === offer.id ? 'border-rose-600' : 'border-gray-300'}`}>
                          {formData.offer === offer.id && <div className="w-2.5 h-2.5 bg-rose-600 rounded-full" />}
                        </div>
                        <span className="font-bold text-slate-900">{offer.title}</span>
                      </div>
                      <span className="text-sm text-slate-500 mr-7">{offer.desc}</span>
                    </div>
                    <div className="text-left">
                      <div className="font-black text-rose-600 text-lg">{offer.price} دج</div>
                      <div className="text-xs text-slate-400 line-through">{offer.oldPrice} دج</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Variants (Colors or Sizes) */}
            {variants.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-rose-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
                  <h2 className="text-xl font-black text-slate-900">
                    اختر {variantNameDisplay}
                  </h2>
                </div>
                
                {offers.find(o => o.id === formData.offer)?.count! > 1 && (
                  <div className="flex items-center justify-between bg-rose-50 border border-rose-100 p-3 rounded-xl mb-4">
                    <span className="text-sm font-bold text-rose-800">الكمية المتبقية للاختيار:</span>
                    <span className="font-black text-lg text-rose-600">
                      {offers.find(o => o.id === formData.offer)?.count! - (Object.values(formData.selectedVariants).reduce((a: number, b: number) => a + b, 0) as number)} حبات
                    </span>
                  </div>
                )}
                
                <div className={`grid gap-2 ${offers.find(o => o.id === formData.offer)?.count! > 1 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {variants.map((variant) => {
                    const count = formData.selectedVariants[variant.id] || 0;
                    const isSelected = count > 0;
                    const maxCount = offers.find(o => o.id === formData.offer)?.count || 1;
                    const currentTotal = Object.values(formData.selectedVariants).reduce((a: number, b: number) => a + b, 0) as number;
                    
                    return (
                      <div 
                        key={variant.id}
                        onClick={() => {
                          if (maxCount === 1) {
                            const newVariants: Record<string, number> = {};
                            variants.forEach(v => newVariants[v.id] = 0);
                            newVariants[variant.id] = 1;
                            setFormData(prev => ({ ...prev, selectedVariants: newVariants }));
                          } else {
                            if (currentTotal < maxCount) {
                              handleVariantChange(variant.id, 1);
                            }
                          }
                        }}
                        className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer min-h-[80px] ${
                          isSelected 
                            ? 'border-rose-600 bg-rose-50 shadow-sm' 
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        } ${maxCount > 1 && currentTotal >= maxCount && !isSelected ? 'opacity-50 grayscale' : ''}`}
                      >
                        {maxCount > 1 && isSelected && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVariantChange(variant.id, -1);
                            }}
                            className="absolute top-1 left-1 w-6 h-6 bg-white border border-rose-200 text-rose-600 rounded-full flex items-center justify-center hover:bg-rose-100 shadow-sm z-10"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {isSelected && maxCount > 1 && (
                          <div className="absolute top-1 right-1 w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
                            {count}
                          </div>
                        )}
                        
                        {isSelected && maxCount === 1 && (
                          <div className="absolute top-2 right-2">
                            <CheckCircle2 className="w-5 h-5 text-rose-600" />
                          </div>
                        )}
                        
                        <span className="font-bold text-slate-800 text-center leading-tight">{variant.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Customer Info */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-rose-600 text-white rounded-full flex items-center justify-center font-bold">
                  {variants.length > 0 ? '3' : '2'}
                </div>
                <h2 className="text-xl font-black text-slate-900">معلومات التوصيل</h2>
              </div>
              <div className="space-y-4 bg-gray-50 p-5 rounded-2xl border border-gray-100">
                <div>
                  <input 
                    type="text" 
                    value={formData.customerName}
                    onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                    className="w-full px-4 py-3.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-rose-600 focus:border-rose-600 outline-none transition-all bg-white font-medium placeholder:font-normal"
                    placeholder="الاسم واللقب"
                  />
                </div>
                <div>
                  <input 
                    type="tel" 
                    dir="ltr"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-3.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-rose-600 focus:border-rose-600 outline-none transition-all bg-white text-right font-medium placeholder:font-normal"
                    placeholder="رقم الهاتف (مثال: 0550123456)"
                  />
                </div>
                <div>
                  <div className="relative">
                    <select 
                      value={formData.wilaya}
                      onChange={(e) => setFormData({...formData, wilaya: e.target.value})}
                      className="w-full px-4 py-3.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-rose-600 focus:border-rose-600 outline-none transition-all bg-white appearance-none font-medium"
                    >
                      <option value="">اختر الولاية...</option>
                      {WILAYAS.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                    <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <input 
                    type="text" 
                    value={formData.commune}
                    onChange={(e) => setFormData({...formData, commune: e.target.value})}
                    className="w-full px-4 py-3.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-rose-600 focus:border-rose-600 outline-none transition-all bg-white font-medium placeholder:font-normal"
                    placeholder="البلدية أو العنوان بالتفصيل"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              className="w-full bg-rose-600 text-white font-black text-xl py-4 rounded-xl shadow-lg shadow-rose-200 flex items-center justify-center gap-2 mb-8"
            >
              <Truck className="w-6 h-6" />
              تأكيد الطلب الآن
            </button>
          </form>
        </div>
        
        {/* Footer */}
        <div className="py-8 text-center bg-slate-50 border-t border-gray-200">
          <p className="text-sm text-slate-500 mb-4">
            &copy; {new Date().getFullYear()} K&K Store. جميع الحقوق محفوظة.
          </p>
          <Link to="/admin" className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all shadow-sm">
            <Lock className="w-3 h-3" />
            الدخول للوحة التحكم
          </Link>
        </div>
      </main>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" dir="rtl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-rose-400 to-rose-600" />
              
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", bounce: 0.6 }}
                className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </motion.div>
              
              <h2 className="text-2xl font-black text-slate-900 mb-2">تم تأكيد طلبك! 🎉</h2>
              <p className="text-slate-600 font-medium mb-8 leading-relaxed">
                شكراً لثقتك بنا. سنتصل بك في أقرب وقت لتأكيد تفاصيل التوصيل.
              </p>
              
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 transition-colors active:scale-95"
              >
                إغلاق
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
