import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProducts, deleteProduct, updateProduct, Product, subscribeToAppSettings, AppSettings } from '../lib/data';
import { Package, Plus, Trash2, Edit2, Image as ImageIcon, ArrowRight, Upload, X, CheckCircle, XCircle, LogOut, Link as LinkIcon, Crop as CropIcon, Sparkles, RefreshCcw, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { generateProductDetailsFromImages } from '../lib/gemini';

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Aggressive compression to fit more images in Firestore (1MB limit)
        const MAX_WIDTH = 600; 
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        // Using lower quality (0.5) to ensure we can store many images within the 1MB Firestore limit
        resolve(canvas.toDataURL('image/jpeg', 0.5));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

interface MediaUpload {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const { logout, appSettings } = useAuth();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [oldPrice, setOldPrice] = useState('');
  const [variantName, setVariantName] = useState('');
  const [variantOptions, setVariantOptions] = useState('');
  const [offer2Price, setOffer2Price] = useState('');
  const [offer4Price, setOffer4Price] = useState('');
  const [features, setFeatures] = useState<string[]>(['']);
  const [isSecretPackaging, setIsSecretPackaging] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<MediaUpload[]>([]);

  // Crop state
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [currentCropImage, setCurrentCropImage] = useState<{ id: string, url: string } | null>(null);
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 90,
    height: 90,
    x: 5,
    y: 5
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const data = await getProducts();
    setProducts(data);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newUploads: MediaUpload[] = Array.from(selectedFiles).map(file => ({
      id: Math.random().toString(36).substring(7),
      file: file as File,
      previewUrl: '',
      progress: 0,
      status: 'uploading'
    }));

    setMediaFiles(prev => [...prev, ...newUploads]);

    for (const uploadItem of newUploads) {
      try {
        if (uploadItem.file.type.startsWith('video/')) {
          toast.error('عذراً، رفع الفيديوهات غير مدعوم في النسخة المجانية');
          setMediaFiles(prev => prev.filter(item => item.id !== uploadItem.id));
          continue;
        }

        setMediaFiles(prev => prev.map(item => 
          item.id === uploadItem.id ? { ...item, progress: 50 } : item
        ));

        const base64String = await compressImage(uploadItem.file);
        
        setMediaFiles(prev => prev.map(item => 
          item.id === uploadItem.id ? { ...item, status: 'completed', previewUrl: base64String, progress: 100 } : item
        ));
      } catch (error) {
        setMediaFiles(prev => prev.map(item => 
          item.id === uploadItem.id ? { ...item, status: 'error' } : item
        ));
        toast.error(`خطأ في معالجة ${uploadItem.file.name}`);
      }
    }

    // Reset file input so the same file can be selected again if needed
    e.target.value = '';
  };

  const removeMedia = (idToRemove: string) => {
    setMediaFiles(prev => prev.filter(item => item.id !== idToRemove));
  };

  const openCropModal = (id: string, url: string) => {
    setCurrentCropImage({ id, url });
    setCropModalOpen(true);
  };

  const getCroppedImg = (image: HTMLImageElement, crop: PixelCrop): Promise<string> => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return Promise.reject(new Error('No 2d context'));
    }

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
      }, 'image/jpeg', 0.9);
    });
  };

  const handleSaveCrop = async () => {
    if (imgRef.current && completedCrop && currentCropImage) {
      try {
        const croppedImageUrl = await getCroppedImg(imgRef.current, completedCrop);
        setMediaFiles(prev => prev.map(item => 
          item.id === currentCropImage.id ? { ...item, previewUrl: croppedImageUrl } : item
        ));
        setCropModalOpen(false);
        setCurrentCropImage(null);
        toast.success('تم قص الصورة بنجاح');
      } catch (e) {
        console.error(e);
        toast.error('حدث خطأ أثناء قص الصورة');
      }
    }
  };

  const handleGenerateAI = async () => {
    const validImages = mediaFiles.filter(m => m.status === 'completed' && m.previewUrl && !m.file.type.startsWith('video/'));
    if (validImages.length === 0) {
      toast.error('يرجى رفع صورة المنتج أولاً لاستخدام الذكاء الاصطناعي');
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading('جاري تحليل الصور وتوليد الوصف...');
    
    try {
      // Analyze up to 10 images for better context without overwhelming the prompt
      const imageBatch = validImages.slice(0, 10).map(m => m.previewUrl!);
      const data = await generateProductDetailsFromImages(imageBatch);
      if (data) {
        setName(data.name);
        setDescription(data.description);
        setFeatures(data.features);
        if (data.suggestedPrice) setPrice(data.suggestedPrice.toString());
        toast.success('تم توليد تفاصيل المنتج بنجاح!', { id: toastId });
      } else {
        toast.error('لم نتمكن من توليد التفاصيل، حاول مرة أخرى', { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء الاتصال بالذكاء الاصطناعي', { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const completedMedia = mediaFiles.filter(m => m.status === 'completed' && m.previewUrl).map(m => m.previewUrl);
    const isUploading = mediaFiles.some(m => m.status === 'uploading');

    if (!name || !price || mediaFiles.length === 0) {
      toast.error('يرجى إدخال اسم المنتج، السعر، واختيار صورة واحدة على الأقل');
      return;
    }

    if (isUploading) {
      toast.error('يرجى انتظار اكتمال رفع جميع الملفات');
      return;
    }

    if (completedMedia.length === 0) {
      toast.error('لم يتم رفع أي ملف بنجاح');
      return;
    }

    setIsSubmitting(true);
    try {
      // Parse separated values using regex to support multiple delimiters
      const optionsList = variantOptions.split(/[,.،\-؛;]/).map(o => o.trim()).filter(o => o);
      
      const newProduct = {
        name,
        description,
        price: Number(price),
        oldPrice: oldPrice ? Number(oldPrice) : null,
        variantName: variantName.trim() || null,
        variantOptions: optionsList.length > 0 ? optionsList : null,
        features: features.filter(f => f.trim() !== ''),
        isSecretPackaging,
        media: completedMedia,
        date: new Date().toISOString()
      };

      if (editingId) {
        await updateProduct(editingId, newProduct);
        toast.success('تم تحديث المنتج بنجاح');
      } else {
        await addDoc(collection(db, 'products'), newProduct);
        toast.success('تمت إضافة المنتج بنجاح');
      }

      setIsAdding(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء حفظ المنتج');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (product: Product) => {
    try {
      setName(product.name || '');
      setDescription(product.description || '');
      setPrice(product.price ? product.price.toString() : '');
      setOldPrice(product.oldPrice ? product.oldPrice.toString() : '');
      setVariantName(product.variantName || '');
      setVariantOptions(product.variantOptions && Array.isArray(product.variantOptions) ? product.variantOptions.join(', ') : '');
      setOffer2Price(product.offer2Price ? product.offer2Price.toString() : '');
      setOffer4Price(product.offer4Price ? product.offer4Price.toString() : '');
      setFeatures(product.features && product.features.length > 0 ? product.features : ['']);
      setIsSecretPackaging(product.isSecretPackaging || false);
      
      // Load existing media
      const existingMedia: MediaUpload[] = (product.media || []).map((url, index) => {
        const fileName = url.startsWith('data:') ? `صورة-${index + 1}.jpg` : (url.split('/').pop()?.split('?')[0] || `صورة-${index + 1}.jpg`);
        return {
          id: `existing-${index}-${Math.random().toString(36).substring(7)}`,
          file: new File([], fileName, { type: 'image/jpeg' }),
          previewUrl: url,
          progress: 100,
          status: 'completed'
        };
      });
      
      setMediaFiles(existingMedia); 
      setIsAdding(true);
      setEditingId(product.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error("Error in handleEdit:", error);
      toast.error("حدث خطأ أثناء محاولة تعديل المنتج");
    }
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    try {
      await deleteProduct(productToDelete);
      toast.success('تم حذف المنتج');
      fetchProducts();
    } catch (error) {
      toast.error('حدث خطأ أثناء الحذف');
    } finally {
      setProductToDelete(null);
    }
  };

  const handleDelete = (id: string) => {
    setProductToDelete(id);
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrice('');
    setOldPrice('');
    setVariantName('');
    setVariantOptions('');
    setOffer2Price('');
    setOffer4Price('');
    setFeatures(['']);
    setIsSecretPackaging(false);
    setMediaFiles([]);
    setEditingId(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link to="/admin" className="p-2.5 bg-white rounded-xl shadow-sm hover:bg-slate-50 transition-all border border-slate-100 flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-slate-600" />
              </Link>
              <div className="flex items-center gap-4 mr-2">
                <div className="w-20 h-20 flex items-center justify-center overflow-hidden">
                  <img src={appSettings.logoUrl || "/logo.png"} alt="Logo" className="w-full h-full object-contain" />
                </div>
                <h1 className="text-4xl font-black text-brand-teal tracking-tighter uppercase">{appSettings.storeName || "KINAN STORE"}</h1>
              </div>
            </div>
            <p className="text-slate-500 mt-1 font-medium mr-12 opacity-70">إدارة منتجات متجر كنان</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={logout} className="p-3 bg-white text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl shadow-sm transition-colors" title="تسجيل الخروج">
              <LogOut className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsAdding(!isAdding)}
              className="bg-brand-teal text-white px-6 py-3 rounded-xl shadow-lg shadow-brand-teal/20 hover:bg-brand-teal/90 transition-all flex items-center gap-2 font-bold"
            >
              {isAdding ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {isAdding ? 'إلغاء' : 'إضافة منتج جديد'}
            </button>
          </div>
        </div>

        {isAdding && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">تفاصيل المنتج الجديد</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">اسم المنتج *</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-slate-600 focus:border-slate-600 outline-none transition-all"
                    placeholder="مثال: حذاء رياضي"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">السعر (دج) *</label>
                    <input 
                      type="number" 
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-slate-600 focus:border-slate-600 outline-none transition-all"
                      placeholder="مثال: 4500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">السعر القديم (اختياري)</label>
                    <input 
                      type="number" 
                      value={oldPrice}
                      onChange={(e) => setOldPrice(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-slate-600 focus:border-slate-600 outline-none transition-all"
                      placeholder="مثال: 6000"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-700">الوصف</label>
                    <button
                      type="button"
                      onClick={handleGenerateAI}
                      disabled={isGenerating || mediaFiles.length === 0}
                      className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {isGenerating ? 'جاري التوليد...' : 'توليد بالذكاء الاصطناعي'}
                    </button>
                  </div>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-slate-600 focus:border-slate-600 outline-none transition-all"
                    rows={4}
                    placeholder="وصف تفصيلي للمنتج..."
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-700">الميزات (Features)</label>
                    <button
                      type="button"
                      onClick={() => setFeatures([...features, ''])}
                      className="text-sm text-rose-600 font-medium hover:text-rose-700 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      إضافة ميزة
                    </button>
                  </div>
                  <div className="space-y-2">
                    {features.map((feature, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={feature}
                          onChange={(e) => {
                            const newFeatures = [...features];
                            newFeatures[index] = e.target.value;
                            setFeatures(newFeatures);
                          }}
                          className="flex-1 px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-slate-600 focus:border-slate-600 outline-none transition-all"
                          placeholder={`الميزة ${index + 1}...`}
                        />
                        {features.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newFeatures = features.filter((_, i) => i !== index);
                              setFeatures(newFeatures);
                            }}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={isSecretPackaging}
                      onChange={(e) => setIsSecretPackaging(e.target.checked)}
                      className="w-5 h-5 text-rose-600 rounded border-slate-300 focus:ring-rose-600"
                    />
                    <div>
                      <span className="block text-sm font-bold text-slate-900">تغليف سري 100%</span>
                      <span className="block text-xs text-slate-500 mt-0.5">تفعيل خيار التغليف السري لهذا المنتج (سيظهر للزبون في صفحة المنتج)</span>
                    </div>
                  </label>
                </div>

                <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h3 className="font-bold text-slate-800 mb-4">خيارات المنتج (اختياري)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">اسم الخاصية</label>
                      <input 
                        type="text" 
                        value={variantName}
                        onChange={(e) => setVariantName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-slate-600 focus:border-slate-600 outline-none transition-all"
                        placeholder="مثال: اللون، النوع، النكهة، المقاس..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">الخيارات المتاحة</label>
                      <input 
                        type="text" 
                        value={variantOptions}
                        onChange={(e) => setVariantOptions(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-slate-600 focus:border-slate-600 outline-none transition-all"
                        placeholder="افصل بينها بفاصلة، مثال: أحمر، أزرق، أسود"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h3 className="font-bold text-slate-800 mb-4">العروض الخاصة (اختياري)</h3>
                  <p className="text-sm text-slate-500 mb-4">إذا تركت هذه الحقول فارغة، سيتم حساب السعر تلقائياً (السعر × الكمية).</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">سعر العرض الذهبي (حبتين)</label>
                      <input 
                        type="number" 
                        value={offer2Price}
                        onChange={(e) => setOffer2Price(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-slate-600 focus:border-slate-600 outline-none transition-all"
                        placeholder="مثال: 8000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">سعر الباقة الكاملة (4 حبات)</label>
                      <input 
                        type="number" 
                        value={offer4Price}
                        onChange={(e) => setOffer4Price(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-slate-600 focus:border-slate-600 outline-none transition-all"
                        placeholder="مثال: 15000"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-700">الصور والفيديوهات *</label>
                  </div>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors relative">
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="media-upload"
                    />
                    <label htmlFor="media-upload" className="cursor-pointer flex flex-col items-center">
                      <Upload className="w-10 h-10 text-slate-400 mb-3" />
                      <span className="text-slate-600 font-medium mb-1">
                        اضغط لاختيار الصور من هاتفك
                      </span>
                      <span className="text-slate-400 text-sm">يمكنك اختيار أكثر من صورة (الفيديو غير مدعوم حالياً)</span>
                    </label>
                  </div>
                  
                  {/* Uploaded Media List - Compact Grid for supporting 20+ images */}
                  {mediaFiles.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                      {mediaFiles.map((item) => (
                        <div key={item.id} className="relative aspect-square bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm group">
                          {item.previewUrl ? (
                            <img src={item.previewUrl} alt="preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-50">
                              <ImageIcon className="w-6 h-6 text-slate-300 animate-pulse" />
                            </div>
                          )}
                          
                          {/* Status Indicator */}
                          <div className="absolute top-1 left-1">
                            {item.status === 'completed' && <CheckCircle className="w-4 h-4 text-emerald-500 bg-white rounded-full" />}
                            {item.status === 'error' && <XCircle className="w-4 h-4 text-red-500 bg-white rounded-full" />}
                          </div>

                          {/* Action Overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 gap-1">
                            {item.status === 'completed' && item.previewUrl && (
                              <button
                                type="button"
                                onClick={() => openCropModal(item.id, item.previewUrl!)}
                                className="p-1 px-2 bg-white text-indigo-600 rounded-md text-[10px] font-bold shadow-sm hover:bg-slate-50"
                              >
                                قص
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeMedia(item.id)}
                              className="p-1 px-2 bg-white text-red-600 rounded-md text-[10px] font-bold shadow-sm hover:bg-slate-50"
                            >
                              حذف
                            </button>
                          </div>
                          
                          {/* Progress Bar for Uploading */}
                          {item.status === 'uploading' && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100">
                              <div className="bg-blue-500 h-full transition-all" style={{ width: `${item.progress}%` }}></div>
                            </div>
                          )}

                          {/* Order Number */}
                          <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold backdrop-blur-sm">
                            {mediaFiles.indexOf(item) + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => { setIsAdding(false); resetForm(); }}
                  className="px-6 py-3 rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting || mediaFiles.some(m => m.status === 'uploading')}
                  className="bg-slate-900 text-white px-8 py-3 rounded-xl shadow-sm hover:bg-slate-800 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <RefreshCcw className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? 'جاري الحفظ...' : (editingId ? 'تحديث المنتج' : 'حفظ المنتج')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Products List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.length === 0 && !isAdding ? (
            <div className="col-span-full bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>لا توجد منتجات حالياً. اضغط على "إضافة منتج جديد" للبدء.</p>
            </div>
          ) : (
            products.map(product => (
              <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="aspect-square bg-slate-100 relative overflow-hidden">
                  {product.media && product.media.length > 0 ? (
                    product.media[0].endsWith('.mp4') || product.media[0].endsWith('.webm') ? (
                      <video src={product.media[0]} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                    ) : (
                      <img src={product.media[0]} alt={product.name} className="w-full h-full object-cover" />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ImageIcon className="w-12 h-12" />
                    </div>
                  )}
                  {product.media && product.media.length > 1 && (
                    <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
                      +{product.media.length - 1}
                    </div>
                  )}
                </div>
                
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="font-bold text-lg text-slate-900 mb-1">{product.name}</h3>
                  <div className="flex items-end gap-2 mb-3">
                    <span className="font-black text-rose-600 text-xl">{product.price} دج</span>
                    {product.oldPrice && (
                      <span className="text-sm text-slate-400 line-through mb-0.5">{product.oldPrice} دج</span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mb-4">
                    {product.colors && product.colors.length > 0 && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200">
                        {product.colors.length} ألوان
                      </span>
                    )}
                    {product.sizes && product.sizes.length > 0 && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200">
                        {product.sizes.length} مقاسات
                      </span>
                    )}
                  </div>

                  <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            // RADICAL FIX: Force Vercel domain if not in dev
                            let baseUrl = import.meta.env.VITE_PUBLIC_DOMAIN || window.location.origin;
                            
                            // If we are on Vercel, use the current hostname
                            if (window.location.hostname.includes('vercel.app')) {
                              baseUrl = `https://${window.location.hostname}`;
                            } else {
                              // Fallback to the known Vercel domain if we're in AI Studio
                              baseUrl = import.meta.env.VITE_PUBLIC_DOMAIN || 'https://kinanstore-lac.vercel.app';
                            }
                            
                            baseUrl = baseUrl.replace(/\/$/, '');
                            const url = `${baseUrl}/p/${product.id}`;
                            
                            navigator.clipboard.writeText(url);
                            toast.success('تم نسخ رابط Vercel بنجاح!');
                          }}
                          className="text-slate-500 hover:text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium flex items-center gap-1 border border-slate-200"
                          title="نسخ رابط صفحة الهبوط"
                        >
                          <LinkIcon className="w-4 h-4" />
                          نسخ الرابط
                        </button>
                        <a 
                          href={`/p/${product.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium flex items-center gap-1 border border-indigo-100"
                        >
                          <ArrowRight className="w-4 h-4 rotate-180" />
                          معاينة
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">
                          {new Date(product.date).toLocaleDateString('en-GB')}
                        </span>
                        <button 
                          onClick={() => handleEdit(product)}
                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                          title="تعديل المنتج"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(product.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                          title="حذف المنتج"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        {/* Delete Confirmation Modal */}
        {productToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
              <h3 className="text-xl font-bold text-slate-900 mb-2">تأكيد الحذف</h3>
              <p className="text-slate-600 mb-6">هل أنت متأكد من أنك تريد حذف هذا المنتج نهائياً؟ لا يمكن التراجع عن هذا الإجراء.</p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setProductToDelete(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  حذف نهائي
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Crop Modal */}
        {cropModalOpen && currentCropImage && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-xl max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-900">قص الصورة</h3>
                <button 
                  onClick={() => setCropModalOpen(false)}
                  className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-auto bg-slate-50 rounded-xl flex items-center justify-center p-4 min-h-[300px]">
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={1} // Square aspect ratio for product images
                >
                  <img
                    ref={imgRef}
                    src={currentCropImage.url}
                    alt="Crop preview"
                    className="max-w-full max-h-[50vh] object-contain"
                  />
                </ReactCrop>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button 
                  onClick={() => setCropModalOpen(false)}
                  className="px-6 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors font-medium"
                >
                  إلغاء
                </button>
                <button 
                  onClick={handleSaveCrop}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium flex items-center gap-2"
                >
                  <CropIcon className="w-4 h-4" />
                  حفظ التعديل
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
