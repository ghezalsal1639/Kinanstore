import React, { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, Package, Truck, Star, CheckCircle2, Lock, ChevronDown, X, Sparkles, CheckCircle, MapPin, Home, ChevronLeft, ChevronRight, Clock, Flame, ShoppingBag, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { saveOrder, getProduct, Product, subscribeToAppSettings, AppSettings } from '../lib/data';
import { ALGERIA_CITIES, Wilaya } from '../lib/algeria-cities';

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [activeImage, setActiveImage] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [timeLeft, setTimeLeft] = useState<{h: number, m: number, s: number}>({ h: 0, m: 0, s: 0 });
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Initialize countdown with a random value between 2 and 8 hours
  useEffect(() => {
    const storageKey = `countdown_${id || 'default'}`;
    const savedEndTime = localStorage.getItem(storageKey);
    let endTime: number;

    if (savedEndTime) {
      endTime = parseInt(savedEndTime);
      // If saved time is in the past, reset it
      if (endTime < Date.now()) {
        const randomHours = Math.floor(Math.random() * 6) + 2; // 2 to 7 hours
        endTime = Date.now() + (randomHours * 3600 * 1000);
        localStorage.setItem(storageKey, endTime.toString());
      }
    } else {
      const randomHours = Math.floor(Math.random() * 6) + 2;
      endTime = Date.now() + (randomHours * 3600 * 1000);
      localStorage.setItem(storageKey, endTime.toString());
    }

    const timer = setInterval(() => {
      const now = Date.now();
      const distance = endTime - now;

      if (distance < 0) {
        clearInterval(timer);
        return;
      }

      setTimeLeft({
        h: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        m: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        s: Math.floor((distance % (1000 * 60)) / 1000)
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [id]);
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>({});
  
  useEffect(() => {
    const unsubscribe = subscribeToAppSettings(setAppSettings);
    return () => unsubscribe();
  }, []);

  const [offers, setOffers] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [variantType, setVariantType] = useState<'colors' | 'sizes' | 'none'>('none');
  const [variantNameDisplay, setVariantNameDisplay] = useState('الخيار');

  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    wilaya: '',
    commune: '',
    address: '',
    deliveryMethod: 'home',
    offer: '1-pack',
    selectedVariants: {} as Record<string, number>,
  });

  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Derive filtered communes directly from the selected wilaya
  const filteredCommunes = useMemo(() => {
    if (!formData.wilaya) return [];
    const selected = ALGERIA_CITIES.find(t => t.name === formData.wilaya);
    if (!selected) return [];
    // Remove duplicates and sort alphabetically
    return Array.from(new Set(selected.communes)).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [formData.wilaya]);

  const productImages = useMemo(() => {
    if (!product) return ["https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?q=80&w=800&auto=format&fit=crop"];
    return product.media && product.media.length > 0 
      ? product.media 
      : ["https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?q=80&w=800&auto=format&fit=crop"];
  }, [product]);

  const selectedOfferData = useMemo(() => {
    return offers.find(o => o.id === formData.offer) || offers[0];
  }, [offers, formData.offer]);

  useEffect(() => {
    if (!isAutoPlaying || !productImages || productImages.length <= 1) return;

    const interval = setInterval(() => {
      setActiveImage((prev) => {
        const next = (prev + 1) % productImages.length;
        if (scrollRef.current) {
          const width = scrollRef.current.clientWidth;
          scrollRef.current.scrollTo({
            left: next * width,
            behavior: 'smooth'
          });
        }
        return next;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, productImages.length]);

  const handleManualScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    const width = e.currentTarget.clientWidth;
    const newIdx = Math.round(scrollLeft / width);
    if (newIdx !== activeImage) {
      setActiveImage(newIdx);
    }
  };

  const goToImage = (idx: number) => {
    if (scrollRef.current) {
      const width = scrollRef.current.clientWidth;
      scrollRef.current.scrollTo({
        left: idx * width,
        behavior: 'smooth'
      });
      setActiveImage(idx);
      setIsAutoPlaying(false);
    }
  };

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
    return <div className="min-h-screen bg-gray-50" />;
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

  const handleWilayaChange = (wilayaName: string) => {
    // Just update the wilaya and reset the commune
    // The filteredCommunes will update automatically via useMemo
    setFormData(prev => ({ ...prev, wilaya: wilayaName, commune: '' }));
  };

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
    
    const isPhoneValid = /^(05|06|07)\d{8}$/.test(formData.phone.trim());
    
    const newErrors: Record<string, boolean> = {
      customerName: !formData.customerName.trim(),
      phone: !formData.phone.trim() || !isPhoneValid,
      wilaya: !formData.wilaya,
      commune: !formData.commune,
      address: formData.deliveryMethod === 'home' ? !formData.address.trim() : false,
    };
    
    // Reset errors first to allow re-triggering animation
    setErrors({});
    
    // Small delay to ensure React picks up the state change for animation re-trigger
    setTimeout(() => {
      setErrors(newErrors);
      if (Object.values(newErrors).some(v => v)) {
        toast.error('يرجى ملء جميع المعلومات المطلوبة');
      }
    }, 10);

    if (Object.values(newErrors).some(v => v)) {
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
        address: formData.deliveryMethod === 'home' ? formData.address : 'توصيل للمكتب',
        deliveryMethod: formData.deliveryMethod,
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
        address: '',
        deliveryMethod: 'home',
        offer: '1-pack',
        selectedVariants: initialVariants,
      });
      setActiveImage(0);
    } catch (err) {
      toast.error('حدث خطأ أثناء حفظ الطلب. يرجى المحاولة مرة أخرى.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Top Announcement Bar */}
      <div className="bg-brand-teal text-brand-gold-light text-center py-2 text-sm font-medium px-4 border-b border-brand-gold/20">
        ✨ عرض فخم: اطلب الآن من {appSettings.storeName || "كنان ستور"} واستفد من التوصيل السريع!
      </div>

      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100 shadow-sm">
        <div className="max-w-md mx-auto px-4 h-28 flex items-center">
          <div className="flex-1 flex flex-col items-center text-center pr-6">
            <span className="font-black text-2xl tracking-tighter text-brand-teal uppercase leading-none">{appSettings.storeName || "KINAN STORE"}</span>
            <span className="text-[10px] font-bold text-brand-gold uppercase tracking-widest mt-1">Premium Quality</span>
          </div>
          <div className="w-24 h-24 flex items-center justify-center p-1 shrink-0">
            <img src={appSettings.logoUrl || "/logo.png"} alt="Logo" className="w-full h-full object-contain" />
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto bg-white min-h-screen shadow-xl">
        {/* Product Image Gallery (Swipeable) */}
        <div className="relative w-full aspect-square bg-white group p-4" dir="ltr">
          <div 
            ref={scrollRef}
            className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar w-full h-full scroll-smooth rounded-[2.5rem] shadow-inner bg-slate-50"
            onScroll={handleManualScroll}
            onTouchStart={() => setIsAutoPlaying(false)}
            onMouseDown={() => setIsAutoPlaying(false)}
          >
            {productImages.map((img, idx) => (
              <div key={idx} className="w-full h-full shrink-0 snap-center snap-always flex items-center justify-center overflow-hidden">
                {img.endsWith('.mp4') || img.endsWith('.webm') ? (
                  <video src={img} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                ) : (
                  <img 
                    src={img} 
                    alt={`${product.name} ${idx + 1}`} 
                    className="w-full h-full object-contain bg-slate-50 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
            ))}
          </div>
          
          {/* Navigation Arrows */}
          {productImages.length > 1 && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); goToImage(activeImage > 0 ? activeImage - 1 : productImages.length - 1); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-slate-800 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10 hidden md:flex"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); goToImage(activeImage < productImages.length - 1 ? activeImage + 1 : 0); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-slate-800 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10 hidden md:flex"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Active Image Indicator (Counter style for cleaner look) */}
          {productImages.length > 1 && (
            <div className="absolute bottom-8 left-8 bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg border border-white/10 z-10" dir="rtl">
              <span className="text-rose-400">{activeImage + 1}</span>
              <span className="opacity-40">/</span>
              <span>{productImages.length}</span>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="p-5 border-b border-gray-100" dir="rtl">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-brand-teal/10 text-brand-teal text-xs font-bold px-2 py-1 rounded-md">الأكثر مبيعاً</span>
            {product.isSecretPackaging && (
              <span className="flex items-center text-brand-gold text-xs font-bold bg-brand-gold/10 px-2 py-1 rounded-md">
                <Lock className="w-3 h-3 ml-1" /> تغليف سري 100%
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black text-brand-teal mb-2 leading-tight">
            {product.name}
          </h1>
          <div className="flex items-center gap-12 mb-5" dir="rtl">
            <motion.div 
              animate={{ 
                scale: [1, 1.05, 1],
                rotate: [0, -1, 1, -1, 0],
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="relative"
            >
              <div className="absolute inset-0 bg-red-600/10 blur-2xl rounded-full animate-pulse" />
              <div className="relative flex items-end gap-1">
                <span className="text-5xl font-black text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.2)]">
                  {selectedOfferData?.price || product.price}
                </span>
                <span className="text-xl font-black text-red-600 mb-2">دج</span>
              </div>
            </motion.div>

            {(selectedOfferData?.oldPrice || product.oldPrice) && (
              <div className="relative h-16 flex items-center px-6">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ 
                    opacity: [0, 1, 1, 0],
                    y: [0, 0, 0, 15],
                    rotate: [0, 0, 0, 5]
                  }}
                  transition={{ 
                    duration: 3, 
                    repeat: Infinity,
                    times: [0, 0.1, 0.8, 1],
                    ease: "easeInOut"
                  }}
                  className="relative inline-block"
                >
                  <div className="relative">
                    {/* The Old Price Text */}
                    <motion.span 
                      animate={{ 
                        color: ["#64748b", "#64748b", "#f97316", "#ef4444"],
                      }}
                      transition={{ 
                        duration: 3, 
                        repeat: Infinity,
                        times: [0, 0.3, 0.5, 1] 
                      }}
                      className="text-4xl font-black tracking-tight whitespace-nowrap block italic opacity-60"
                    >
                      {selectedOfferData?.oldPrice || product.oldPrice} دج
                    </motion.span>

                    {/* The Sharp Slash Line - Perfectly Sized to Text */}
                    <motion.div 
                      initial={{ scaleX: 0 }}
                      animate={{ 
                        scaleX: [0, 0, 1.1, 1.1],
                      }}
                      transition={{ 
                        duration: 3, 
                        repeat: Infinity,
                        times: [0, 0.3, 0.45, 1],
                        ease: "circOut"
                      }}
                      style={{ originX: 0 }}
                      className="absolute top-[55%] left-[-5%] w-[110%] h-[5px] bg-red-600/90 -translate-y-1/2 rotate-[-12deg] shadow-[0_0_15px_rgba(220,38,38,1)] z-10 rounded-full"
                    />
                  </div>
                </motion.div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 mb-6 bg-red-600/5 border border-red-600/10 p-4 rounded-2xl" dir="rtl">
            <div className="flex items-center gap-1.5 text-red-600 font-black text-sm">
              <Flame className="w-4 h-4 animate-bounce" />
              تخفيضات حصرية تنتهي في:
            </div>
            <div className="flex items-center gap-1.5 mr-auto font-mono text-slate-900">
              <div className="bg-red-600 px-2 py-0.5 rounded-lg shadow-lg flex flex-col items-center min-w-[36px]">
                <span className="text-sm font-black text-white">{timeLeft.h.toString().padStart(2, '0')}</span>
                <span className="text-[8px] font-bold text-white/70 tracking-tighter">ساعة</span>
              </div>
              <span className="font-bold text-red-600 animate-pulse">:</span>
              <div className="bg-red-600 px-2 py-0.5 rounded-lg shadow-lg flex flex-col items-center min-w-[36px]">
                <span className="text-sm font-black text-white">{timeLeft.m.toString().padStart(2, '0')}</span>
                <span className="text-[8px] font-bold text-white/70 tracking-tighter">دقيقة</span>
              </div>
              <span className="font-bold text-red-600 animate-pulse">:</span>
              <div className="bg-white border-2 border-red-600 px-2 py-0.5 rounded-lg shadow-lg flex flex-col items-center min-w-[36px] animate-[pulse_0.5s_ease-in-out_infinite]">
                <span className="text-sm font-black text-red-600">{timeLeft.s.toString().padStart(2, '0')}</span>
                <span className="text-[8px] font-bold text-red-600/70 tracking-tighter">ثانية</span>
              </div>
            </div>
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
            <div className="w-8 h-8 bg-brand-teal text-white rounded-full flex items-center justify-center font-bold">1</div>
            <h2 className="text-xl font-black text-brand-teal">اختر العرض المناسب</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Offers Frame */}
            <div className="bg-white rounded-3xl border border-brand-teal/10 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-brand-teal text-white rounded-full flex items-center justify-center font-bold shadow-md shadow-brand-teal/20">1</div>
                <h2 className="text-xl font-bold text-brand-teal">اختر العرض المناسب</h2>
              </div>
              
              <div className="space-y-3">
                {offers.map((offer) => (
                  <label 
                    key={offer.id}
                    className={`relative block p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      formData.offer === offer.id 
                        ? 'border-brand-teal bg-brand-teal/[0.03]' 
                        : 'border-slate-100 bg-white'
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
                      <div className="absolute top-0 left-4 -translate-y-1/2 bg-brand-gold text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm z-10">
                        الأكثر طلباً
                      </div>
                    )}
                    <div className="flex justify-between items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${formData.offer === offer.id ? 'border-brand-teal' : 'border-slate-300'}`}>
                          {formData.offer === offer.id && <div className="w-3 h-3 bg-brand-teal rounded-full" />}
                        </div>
                        <div className="flex flex-col">
                          <div className="font-bold text-slate-900 leading-tight">
                            {offer.title.includes('(') ? (
                              <>
                                <span>{offer.title.split('(')[0]}</span>
                                <span className="block text-sm text-brand-teal font-bold mt-0.5">({offer.title.split('(')[1]}</span>
                              </>
                            ) : (
                              offer.title
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{offer.desc}</div>
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <div className="font-black text-red-600 text-xl whitespace-nowrap">{offer.price} دج</div>
                        <div className="text-sm text-slate-400 line-through italic whitespace-nowrap opacity-70">{offer.oldPrice} دج</div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Variants (Colors or Sizes) Frame */}
            {variants.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 bg-rose-600 text-white rounded-full flex items-center justify-center font-bold shadow-md shadow-rose-200">2</div>
                  <h2 className="text-xl font-bold text-slate-900">
                    اختر {variantNameDisplay}
                  </h2>
                </div>
                
                {offers.find(o => o.id === formData.offer)?.count! > 1 && (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-3 rounded-xl mb-6">
                    <span className="text-sm font-bold text-emerald-800">الكمية المتبقية للاختيار:</span>
                    <span className="font-black text-lg text-emerald-600">
                      {offers.find(o => o.id === formData.offer)?.count! - (Object.values(formData.selectedVariants).reduce((a: number, b: number) => a + b, 0) as number)} حبات
                    </span>
                  </div>
                )}
                
                <div className={`grid gap-3 ${offers.find(o => o.id === formData.offer)?.count! > 1 ? 'grid-cols-2' : 'grid-cols-2'}`}>
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
                        className={`relative flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all cursor-pointer min-h-[90px] ${
                          isSelected 
                            ? 'border-rose-600 bg-rose-50' 
                            : 'border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-200'
                        } ${maxCount > 1 && currentTotal >= maxCount && !isSelected ? 'opacity-50 grayscale pointer-events-none' : ''}`}
                      >
                        {maxCount > 1 && isSelected && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVariantChange(variant.id, -1);
                            }}
                            className="absolute -top-2 -left-2 w-7 h-7 bg-white border border-rose-200 text-rose-600 rounded-full flex items-center justify-center hover:bg-rose-100 shadow-md z-10"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}

                        {isSelected && maxCount > 1 && (
                          <div className="absolute -top-2 -right-2 w-7 h-7 bg-rose-600 text-white rounded-full flex items-center justify-center text-xs font-black shadow-md">
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
                <div className="flex gap-2 p-1 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, deliveryMethod: 'home' })}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                      formData.deliveryMethod === 'home'
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Home className="w-4 h-4" />
                    للمنزل
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, deliveryMethod: 'office' })}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                      formData.deliveryMethod === 'office'
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                    للمكتب
                  </button>
                </div>
                <div>
                  <input 
                    type="text" 
                    value={formData.customerName}
                    onChange={(e) => {
                      setFormData({...formData, customerName: e.target.value});
                      if (errors.customerName) setErrors({...errors, customerName: false});
                    }}
                    className={`w-full px-4 py-3.5 rounded-xl border outline-none transition-all bg-white font-medium placeholder:font-normal ${
                      errors.customerName 
                        ? 'border-red-500 ring-2 ring-red-100 animate-flash-red' 
                        : 'border-gray-300 focus:ring-2 focus:ring-rose-600 focus:border-rose-600'
                    }`}
                    placeholder="الاسم واللقب"
                  />
                  {errors.customerName && <p className="text-red-500 text-xs mt-1 mr-1 font-bold">يرجى إدخال الاسم واللقب</p>}
                </div>
                <div>
                  <input 
                    type="tel" 
                    dir="ltr"
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({...formData, phone: e.target.value});
                      if (errors.phone) setErrors({...errors, phone: false});
                    }}
                    className={`w-full px-4 py-3.5 rounded-xl border outline-none transition-all bg-white text-right font-medium placeholder:font-normal ${
                      errors.phone 
                        ? 'border-red-500 ring-2 ring-red-100 animate-flash-red' 
                        : 'border-gray-300 focus:ring-2 focus:ring-rose-600 focus:border-rose-600'
                    }`}
                    placeholder="رقم الهاتف (مثال: 0550123456)"
                  />
                  {errors.phone && (
                    <p className="text-red-500 text-xs mt-1 mr-1 font-bold">
                      {formData.phone.trim() === '' ? 'يرجى إدخال رقم الهاتف' : 'رقم الهاتف غير صحيح (يجب أن يبدأ بـ 05، 06 أو 07 ويتكون من 10 أرقام)'}
                    </p>
                  )}
                </div>
                <div>
                  <div className="relative">
                    <select 
                      value={formData.wilaya}
                      onChange={(e) => {
                        handleWilayaChange(e.target.value);
                        if (errors.wilaya) setErrors({...errors, wilaya: false});
                      }}
                      className={`w-full px-4 py-3.5 rounded-xl border outline-none transition-all bg-white appearance-none font-medium ${
                        errors.wilaya 
                          ? 'border-red-500 ring-2 ring-red-100 animate-flash-red' 
                          : 'border-gray-300 focus:ring-2 focus:ring-rose-600 focus:border-rose-600'
                      }`}
                    >
                      <option value="">اختر الولاية...</option>
                      {ALGERIA_CITIES.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                    </select>
                    <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                  {errors.wilaya && <p className="text-red-500 text-xs mt-1 mr-1 font-bold">يرجى اختيار الولاية</p>}
                </div>
                <div>
                  <div className="relative">
                    <select 
                      key={formData.wilaya}
                      value={formData.commune}
                      onChange={(e) => {
                        setFormData({...formData, commune: e.target.value});
                        if (errors.commune) setErrors({...errors, commune: false});
                      }}
                      disabled={!formData.wilaya}
                      className={`w-full px-4 py-3.5 rounded-xl border outline-none transition-all bg-white appearance-none font-medium disabled:bg-gray-100 disabled:text-gray-400 ${
                        errors.commune 
                          ? 'border-red-500 ring-2 ring-red-100 animate-flash-red' 
                          : 'border-gray-300 focus:ring-2 focus:ring-rose-600 focus:border-rose-600'
                      }`}
                    >
                      <option value="">اختر البلدية...</option>
                      {filteredCommunes.map((c, index) => (
                        <option key={`${formData.wilaya}-${c}-${index}`} value={c}>
                          {c}
                        </option>
                      ))}
                      {!formData.wilaya && <option value="">يرجى اختيار الولاية أولاً</option>}
                    </select>
                    <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                  {errors.commune && <p className="text-red-500 text-xs mt-1 mr-1 font-bold">يرجى اختيار البلدية</p>}
                </div>
                {formData.deliveryMethod === 'home' && (
                  <div>
                    <input 
                      type="text" 
                      value={formData.address}
                      onChange={(e) => {
                        setFormData({...formData, address: e.target.value});
                        if (errors.address) setErrors({...errors, address: false});
                      }}
                      className={`w-full px-4 py-3.5 rounded-xl border outline-none transition-all bg-white font-medium placeholder:font-normal ${
                        errors.address 
                          ? 'border-red-500 ring-2 ring-red-100 animate-flash-red' 
                          : 'border-gray-300 focus:ring-2 focus:ring-rose-600 focus:border-rose-600'
                      }`}
                      placeholder="عنوان الدار (مثال: حي 20 مسكن، رقم 5)"
                    />
                    {errors.address && <p className="text-red-500 text-xs mt-1 mr-1 font-bold">يرجى إدخال عنوان الدار</p>}
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              className="w-full bg-brand-teal text-brand-gold-light font-black text-xl py-4 rounded-xl shadow-lg shadow-brand-teal/20 flex items-center justify-center gap-2 mb-8 hover:bg-brand-teal/90 transition-all border border-brand-gold/30"
            >
              <Truck className="w-6 h-6" />
              تأكيد الطلب الآن
            </button>
          </form>
        </div>
        
        {/* Footer */}
        <div className="py-8 text-center bg-slate-50 border-t border-gray-100">
          <p className="text-sm text-slate-500 font-bold uppercase tracking-tight">
            &copy; {new Date().getFullYear()} {appSettings.storeName || "KINAN STORE"}. جميع الحقوق محفوظة.
          </p>
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
