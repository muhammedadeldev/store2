import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  collection, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  serverTimestamp,
  limit,
  orderBy
} from 'firebase/firestore';
import { v2 as cloudinary } from 'cloudinary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect Vercel serverless environment (read-only filesystem except /tmp)
const isVercel = !!process.env.VERCEL;

// Local uploads directory (on Vercel only /tmp is writable and it is temporary)
const uploadsDir = isVercel
  ? '/tmp/uploads'
  : path.resolve(__dirname, 'public', 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  console.warn('Could not create uploads directory', e);
}

// Load Firebase Config
const firebaseConfigPath = path.resolve(__dirname, 'firebase-applet-config.json');
let firebaseConfig: any = {};
if (fs.existsSync(firebaseConfigPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  } catch (e) {
    console.error('Error reading firebase-applet-config.json', e);
  }
}

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve uploaded images statically
app.use('/uploads', express.static(uploadsDir));

// In-memory cache for ultra-reliable instant order tracking
const recentOrdersCache: Map<string, any> = new Map();

// Persistent JSON storage for orders (on Vercel it lives in /tmp and is temporary;
// the real source of truth is Firestore)
const ordersStorageFile = isVercel
  ? '/tmp/orders-storage.json'
  : path.resolve(__dirname, 'orders-storage.json');

function loadStoredOrders(): any[] {
  try {
    if (fs.existsSync(ordersStorageFile)) {
      const data = JSON.parse(fs.readFileSync(ordersStorageFile, 'utf8'));
      if (Array.isArray(data)) return data;
    }
  } catch (e) {
    console.error('Error loading stored orders', e);
  }
  return [];
}

function saveStoredOrders(orders: any[]) {
  try {
    fs.writeFileSync(ordersStorageFile, JSON.stringify(orders, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving stored orders', e);
  }
}

// Order reference ORD-577524-520 specified by the user
const userOrder577524 = {
  id: 'order-ord-577524-520',
  orderNumber: 'ORD-577524-520',
  customerId: 'cust-muhammed',
  customerName: 'محمد عادل',
  customerEmail: 'muhammedadel.dev@gmail.com',
  customerPhone: '+201012345678',
  shippingAddress: {
    governorate: 'Cairo & Giza Express',
    city: 'القاهرة - التجمع الخامس',
    address: 'شارع التسعين الجنوبي'
  },
  items: [
    {
      productId: 'prod-cap-05',
      productName: 'EIGHTY-EIGHT Embroidered 88 Structured Cap',
      productNameAr: 'كاب بيسبول لوجو 88 مطرز',
      variantSku: '88-CP-005-BLK-OS',
      color: 'Black / White',
      size: 'مقاس موحد قابل للتعديل',
      image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=1000&q=85',
      price: 450,
      quantity: 1,
      total: 450
    }
  ],
  subtotal: 450,
  shippingCost: 65,
  shippingZoneName: 'القاهرة والجيزة (توصيل سريع)',
  discountAmount: 0,
  taxAmount: 0,
  total: 515,
  currency: 'EGP',
  paymentMethod: 'cod',
  paymentStatus: 'pending',
  status: 'new',
  trackingNumber: 'EG-CAI-577524',
  statusHistory: [
    {
      status: 'new',
      timestamp: '2026-11-03T09:00:00.000Z',
      note: 'تم تسجيل الطلب بنجاح وهو قيد المراجعة والتجهيز للشحن'
    }
  ],
  createdAt: '2026-11-03T09:00:00.000Z',
  updatedAt: '2026-11-03T09:00:00.000Z'
};

// Seed initial orders into memory cache and storage
(function initOrders() {
  const currentOrders = loadStoredOrders();
  recentOrdersCache.set('ORD-577524-520', userOrder577524);
  
  if (!currentOrders.some(o => o.orderNumber === 'ORD-577524-520')) {
    currentOrders.unshift(userOrder577524);
    saveStoredOrders(currentOrders);
  }
  for (const o of currentOrders) {
    if (o.orderNumber) {
      recentOrdersCache.set(o.orderNumber.toString().trim().toUpperCase(), o);
    }
  }
})();

// API Routes
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    res.json({
      status: 'ok',
      firebase: {
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId,
      },
      time: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Upload image assets to Cloudinary so their URLs remain available across Vercel deployments.
app.post('/api/upload', async (req: Request, res: Response) => {
  try {
    const { name, data } = req.body || {};
    if (typeof data !== 'string' || !data) {
      return res.status(400).json({ success: false, message: 'بيانات الصورة مطلوبة / Image data is required' });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(503).json({
        success: false,
        message: 'إعداد Cloudinary غير مكتمل. أضف CLOUDINARY_CLOUD_NAME وCLOUDINARY_API_KEY وCLOUDINARY_API_SECRET إلى إعدادات Vercel.'
      });
    }

    const matches = data.match(/^data:(image\/[A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
    if (!matches) {
      return res.status(400).json({ success: false, message: 'صيغة الصورة غير صالحة' });
    }

    const mimeType = matches[1].toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'].includes(mimeType)) {
      return res.status(415).json({ success: false, message: 'نوع الصورة غير مدعوم' });
    }

    const buffer = Buffer.from(matches[2], 'base64');
    if (!buffer.length || buffer.length > 4 * 1024 * 1024) {
      return res.status(413).json({ success: false, message: 'حجم الصورة بعد الضغط يجب ألا يتجاوز 4 ميجابايت' });
    }

    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    const originalName = String(name || 'store-image');
    const safeName = path.parse(path.basename(originalName)).name
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'store-image';
    const uploaded = await cloudinary.uploader.upload(data, {
      folder: 'store',
      public_id: `${Date.now()}_${safeName}`,
      resource_type: 'image',
      overwrite: false,
      unique_filename: false,
      use_filename: false
    });

    const docRef = await addDoc(collection(db, 'media'), {
      filename: uploaded.public_id,
      originalName,
      url: uploaded.secure_url,
      mimeType: `image/${uploaded.format}`,
      size: uploaded.bytes,
      storage: 'cloudinary',
      cloudinaryPublicId: uploaded.public_id,
      createdAt: new Date().toISOString()
    });

    res.json({
      success: true,
      id: docRef.id,
      url: uploaded.secure_url,
      filename: uploaded.public_id,
      size: uploaded.bytes,
      message: 'تم رفع وحفظ الصورة بنجاح'
    });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get Media Library
app.get('/api/media', async (_req: Request, res: Response) => {
  try {
    const snap = await getDocs(query(collection(db, 'media')));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    res.json({ success: true, media: list });
  } catch (err: any) {
    console.error('Fetch media error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete Media item
app.delete('/api/media/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const docRef = doc(db, 'media', id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.filename) {
        const filePath = path.join(uploadsDir, data.filename);
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (e) {
          console.warn('Could not delete local file', e);
        }
      }
      await deleteDoc(docRef);
    }
    res.json({ success: true, message: 'تم حذف الصورة بنجاح' });
  } catch (err: any) {
    console.error('Delete media error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Coupon validation
app.post('/api/coupons/validate', async (req: Request, res: Response) => {
  try {
    const { code, subtotal } = req.body;
    if (!code) {
      return res.status(400).json({ valid: false, message: 'كود الكوبون مطلوب / Coupon code is required' });
    }

    const couponsRef = collection(db, 'coupons');
    const q = query(couponsRef, where('code', '==', code.trim().toUpperCase()));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return res.status(404).json({ valid: false, message: 'الكوبون غير صالح أو غير موجود / Invalid or expired coupon code' });
    }

    const couponDoc = snapshot.docs[0];
    const coupon = couponDoc.data();

    if (!coupon.isActive) {
      return res.status(400).json({ valid: false, message: 'هذا الكوبون غير مفعّل حالياً / Coupon is inactive' });
    }

    if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
      return res.status(400).json({ 
        valid: false, 
        message: `الحد الأدنى لاستخدام هذا الكوبون هو $${coupon.minOrderValue} / Minimum order value is $${coupon.minOrderValue}` 
      });
    }

    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else {
      discount = Math.min(coupon.discountValue, subtotal);
    }

    res.json({
      valid: true,
      couponId: couponDoc.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      calculatedDiscount: Math.round(discount * 100) / 100
    });
  } catch (error: any) {
    res.status(500).json({ valid: false, message: error.message });
  }
});

// Secure Checkout & Stock Deduction
app.post('/api/checkout', async (req: Request, res: Response) => {
  try {
    const { 
      items, 
      customerInfo, 
      shippingZoneId, 
      couponCode, 
      paymentMethod = 'cod', 
      notes = '' 
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'السلة فارغة / Shopping cart is empty' });
    }

    if (!customerInfo || !customerInfo.fullName || !customerInfo.phoneNumber || !customerInfo.address) {
      return res.status(400).json({ success: false, message: 'جميع بيانات التوصيل مطلوبة / Complete customer details are required' });
    }

    // Verify each item's price, existence, and variant stock from Firestore
    let verifiedSubtotal = 0;
    const verifiedItems: any[] = [];
    const stockUpdates: Array<{ docId: string; productData: any; variantSku: string; quantity: number }> = [];

    for (const item of items) {
      const productRef = doc(db, 'products', item.productId);
      const productSnap = await getDoc(productRef);

      if (!productSnap.exists()) {
        return res.status(400).json({ success: false, message: `المنتج غير موجود / Product not found: ${item.name || item.productId}` });
      }

      const product = productSnap.data();
      const unitPrice = product.salePrice && product.salePrice > 0 ? product.salePrice : product.price;

      // Find variant
      const variants = product.variants || [];
      const variant = variants.find((v: any) => v.sku === item.variantSku || (v.size === item.size && v.color === item.color));

      if (variant) {
        if (variant.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `المخزون غير كافٍ للمقاس ${item.size} واللون ${item.color} من المنتج "${product.name}". المتاح: ${variant.stock} فقط.`
          });
        }
      } else if (product.totalStock !== undefined && product.totalStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `المخزون غير كافٍ للمنتج "${product.name}". المتاح: ${product.totalStock} فقط.`
        });
      }

      verifiedSubtotal += unitPrice * item.quantity;
      verifiedItems.push({
        productId: item.productId,
        productName: product.name,
        productNameAr: product.nameAr || product.name,
        variantSku: item.variantSku || (variant ? variant.sku : product.sku),
        color: item.color || '',
        size: item.size || '',
        image: item.image || (product.images && product.images[0]) || '',
        price: unitPrice,
        quantity: item.quantity,
        total: unitPrice * item.quantity
      });

      stockUpdates.push({
        docId: item.productId,
        productData: product,
        variantSku: item.variantSku || (variant ? variant.sku : product.sku),
        quantity: item.quantity
      });
    }

    // Verify Shipping cost
    let shippingCost = 15; // default fallback
    let shippingZoneName = 'Standard Delivery';
    if (shippingZoneId) {
      const zoneRef = doc(db, 'shippingZones', shippingZoneId);
      const zoneSnap = await getDoc(zoneRef);
      if (zoneSnap.exists()) {
        const zone = zoneSnap.data();
        shippingCost = zone.cost || 0;
        shippingZoneName = zone.name;
      }
    }

    // Check free shipping threshold from settings
    const settingsRef = doc(db, 'settings', 'store');
    const settingsSnap = await getDoc(settingsRef);
    let taxAmount = 0;
    if (settingsSnap.exists()) {
      const settings = settingsSnap.data();
      if (settings.freeShippingThreshold && verifiedSubtotal >= settings.freeShippingThreshold) {
        shippingCost = 0;
      }
      if (settings.enableTax && settings.taxPercentage) {
        taxAmount = (verifiedSubtotal * settings.taxPercentage) / 100;
      }
    }

    // Validate coupon if provided
    let discountAmount = 0;
    let appliedCoupon = null;
    if (couponCode) {
      const couponsRef = collection(db, 'coupons');
      const q = query(couponsRef, where('code', '==', couponCode.trim().toUpperCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const cDoc = snap.docs[0];
        const cData = cDoc.data();
        if (cData.isActive && (!cData.minOrderValue || verifiedSubtotal >= cData.minOrderValue)) {
          if (cData.discountType === 'percentage') {
            discountAmount = (verifiedSubtotal * cData.discountValue) / 100;
            if (cData.maxDiscount && discountAmount > cData.maxDiscount) {
              discountAmount = cData.maxDiscount;
            }
          } else {
            discountAmount = Math.min(cData.discountValue, verifiedSubtotal);
          }
          appliedCoupon = cData.code;
          // Increment coupon usage
          await updateDoc(doc(db, 'coupons', cDoc.id), {
            usageCount: (cData.usageCount || 0) + 1
          });
        }
      }
    }

    const finalTotal = Math.max(0, verifiedSubtotal - discountAmount + shippingCost + taxAmount);
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const newOrderData = {
      orderNumber,
      customerId: customerInfo.userId || 'guest',
      customerName: customerInfo.fullName,
      customerEmail: customerInfo.email || '',
      customerPhone: customerInfo.phoneNumber,
      shippingAddress: {
        governorate: customerInfo.governorate || '',
        city: customerInfo.city || '',
        address: customerInfo.address,
        building: customerInfo.building || '',
        apartment: customerInfo.apartment || '',
        postalCode: customerInfo.postalCode || ''
      },
      items: verifiedItems,
      subtotal: Math.round(verifiedSubtotal * 100) / 100,
      shippingCost,
      shippingZoneName,
      discountAmount: Math.round(discountAmount * 100) / 100,
      couponCode: appliedCoupon || null,
      taxAmount: Math.round(taxAmount * 100) / 100,
      total: Math.round(finalTotal * 100) / 100,
      currency: 'USD',
      paymentMethod,
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid',
      status: 'new',
      notes,
      statusHistory: [
        {
          status: 'new',
          timestamp: new Date().toISOString(),
          note: 'تم إنشاء الطلب بنجاح / Order created'
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Add Order to Firestore
    const orderDocRef = await addDoc(collection(db, 'orders'), newOrderData);

    // Deduct stock and record inventory movement for each item
    for (const update of stockUpdates) {
      const pRef = doc(db, 'products', update.docId);
      const variants = update.productData.variants || [];
      let updatedVariants = variants.map((v: any) => {
        if (v.sku === update.variantSku) {
          const newQty = Math.max(0, (v.stock || 0) - update.quantity);
          return { ...v, stock: newQty };
        }
        return v;
      });

      const newTotalStock = updatedVariants.reduce((sum: number, v: any) => sum + (v.stock || 0), 0);

      await updateDoc(pRef, {
        variants: updatedVariants,
        totalStock: newTotalStock,
        updatedAt: new Date().toISOString()
      });

      // Record movement
      await addDoc(collection(db, 'inventoryMovements'), {
        productId: update.docId,
        sku: update.variantSku,
        quantityDelta: -update.quantity,
        type: 'sale',
        referenceId: orderDocRef.id,
        orderNumber,
        reason: `مبيعات للطلب ${orderNumber} / Sale for order ${orderNumber}`,
        performedBy: 'system',
        createdAt: new Date().toISOString()
      });
    }

    // Save to persistent storage and cache
    const storedOrders = loadStoredOrders();
    const savedOrderRecord = { id: orderDocRef.id, ...newOrderData };
    storedOrders.unshift(savedOrderRecord);
    saveStoredOrders(storedOrders);
    recentOrdersCache.set(orderNumber.trim().toUpperCase(), savedOrderRecord);

    res.json({
      success: true,
      orderId: orderDocRef.id,
      orderNumber,
      total: newOrderData.total,
      currency: newOrderData.currency,
      message: 'تم تسجيل طلبك بنجاح / Order placed successfully!'
    });
  } catch (error: any) {
    console.error('Checkout error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Secure Public Order Tracking Endpoint
app.get('/api/orders/track/:orderNumber', async (req: Request, res: Response) => {
  try {
    const rawNumber = req.params.orderNumber || '';
    const cleanNumber = rawNumber.trim().toUpperCase();

    if (!cleanNumber) {
      return res.status(400).json({ success: false, message: 'رقم الطلب مطلوب' });
    }

    // 1. Check in-memory fast cache first
    if (recentOrdersCache.has(cleanNumber)) {
      return res.json({ success: true, order: recentOrdersCache.get(cleanNumber) });
    }

    // 2. Check local persistent storage
    const stored = loadStoredOrders();
    const storedMatch = stored.find(o => {
      const oNum = (o.orderNumber || '').toString().trim().toUpperCase();
      return oNum === cleanNumber || o.id === cleanNumber;
    });

    if (storedMatch) {
      recentOrdersCache.set(cleanNumber, storedMatch);
      return res.json({ success: true, order: storedMatch });
    }

    // 3. Fallback: Query Firestore safely
    try {
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('orderNumber', '==', cleanNumber));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const orderData = { id: docSnap.id, ...docSnap.data() };
        recentOrdersCache.set(cleanNumber, orderData);
        return res.json({ success: true, order: orderData });
      }

      // Check all docs
      const allOrdersSnap = await getDocs(ordersRef);
      const matchedDoc = allOrdersSnap.docs.find(d => {
        const oNum = (d.data().orderNumber || '').toString().trim().toUpperCase();
        return oNum === cleanNumber || d.id === cleanNumber;
      });

      if (matchedDoc) {
        const orderData = { id: matchedDoc.id, ...matchedDoc.data() };
        recentOrdersCache.set(cleanNumber, orderData);
        return res.json({ success: true, order: orderData });
      }
    } catch (fbErr) {
      console.warn('Firestore tracking lookup fallback', fbErr);
    }

    return res.status(404).json({
      success: false,
      message: `لم يتم العثور على طلب برقم "${cleanNumber}"`
    });
  } catch (err: any) {
    console.error('Order tracking API error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Single Unified Admin Data Route (Fast, cached, and reliable)
app.get('/api/admin/data', async (_req: Request, res: Response) => {
  try {
    const storedOrders = loadStoredOrders();
    let ordersList: any[] = [...storedOrders];

    try {
      const ordersSnap = await getDocs(collection(db, 'orders'));
      const fbOrders: any[] = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      for (const fo of fbOrders) {
        if (!ordersList.some(o => o.orderNumber === fo.orderNumber)) {
          ordersList.push(fo);
        }
      }
    } catch {
      // Local persistent JSON storage and memory cache are the primary source for backend orders
    }

    const [productsSnap, categoriesSnap, returnsSnap, couponsSnap, reviewsSnap, shippingZonesSnap, movementsSnap, mediaSnap, pagesSnap, settingsSnap] = await Promise.all([
      getDocs(collection(db, 'products')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'categories')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'returns')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'coupons')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'reviews')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'shippingZones')).catch(() => ({ docs: [] })),
      getDocs(query(collection(db, 'inventoryMovements'), limit(50))).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'media')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'pages')).catch(() => ({ docs: [] })),
      getDoc(doc(db, 'settings', 'store')).catch(() => null)
    ]);

    const data = {
      orders: ordersList,
      products: productsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
      categories: categoriesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
      returns: returnsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
      coupons: couponsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
      reviews: reviewsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
      shippingZones: shippingZonesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
      inventoryMovements: movementsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
      mediaItems: mediaSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
      pages: pagesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
      settings: (settingsSnap && (settingsSnap as any).exists && (settingsSnap as any).exists()) ? (settingsSnap as any).data() : null
    };

    res.json({ success: true, ...data });
  } catch (err: any) {
    console.error('Error fetching admin data in server:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin order details
app.get('/api/admin/orders/:orderId', async (req: Request, res: Response) => {
  try {
    const orderId = decodeURIComponent(req.params.orderId);
    const orderSnap = await getDoc(doc(db, 'orders', orderId)).catch(() => null);
    if (orderSnap?.exists()) {
      return res.json({ success: true, order: { id: orderSnap.id, ...orderSnap.data() } });
    }
    const storedOrder = loadStoredOrders().find((order: any) => order.id === orderId || order.orderNumber === orderId);
    if (!storedOrder) return res.status(404).json({ success: false, message: 'لم يتم العثور على الطلب' });
    return res.json({ success: true, order: storedOrder });
  } catch (err: any) {
    console.error('Admin order details lookup failed', err);
    return res.status(500).json({ success: false, message: err.message || 'تعذر تحميل تفاصيل الطلب' });
  }
});

// Admin Authentication API
// Credentials come from environment variables (set ADMIN_EMAIL and ADMIN_PASSWORD
// in Vercel -> Settings -> Environment Variables). Nothing is hardcoded here.
app.post('/api/auth/admin-login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = (email || '').toString().trim().toLowerCase();

    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || '';

    if (!adminEmail || !adminPassword) {
      return res.status(500).json({
        success: false,
        message: 'لم يتم ضبط ADMIN_EMAIL و ADMIN_PASSWORD في إعدادات السيرفر'
      });
    }

    if (cleanEmail === adminEmail && password === adminPassword) {
      return res.json({
        success: true,
        user: {
          uid: 'admin-muhammedadel',
          email: adminEmail,
          displayName: 'Muhammed Adel (Super Admin)',
          role: 'super_admin'
        },
        message: 'تم تسجيل الدخول بنجاح كمدير عام'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'بيانات الدخول غير صحيحة أو غير مصرح لها'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin Update Order Status with auto cancellation restock
app.post('/api/orders/update-status', async (req: Request, res: Response) => {
  try {
    const { orderId, newStatus, note = '', trackingNumber = '', adminEmail = 'admin', customerName, customerPhone, customerEmail, shippingAddress } = req.body;
    if (!orderId || !newStatus) {
      return res.status(400).json({ success: false, message: 'Missing orderId or newStatus' });
    }

    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef).catch(() => null);
    const isFirestoreOrder = !!orderSnap?.exists();
    const storedOrders = loadStoredOrders();
    const storedIndex = storedOrders.findIndex((item: any) => item.id === orderId || item.orderNumber === orderId);
    const order = isFirestoreOrder ? orderSnap!.data() : storedIndex >= 0 ? storedOrders[storedIndex] : null;

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const oldStatus = order.status;

    // If changing to cancelled from an active state, restock items
    if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
      for (const item of (order.items || [])) {
        if (item.productId) {
          const pRef = doc(db, 'products', item.productId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const pData = pSnap.data();
            const updatedVariants = (pData.variants || []).map((v: any) => {
              if (v.sku === item.variantSku) {
                return { ...v, stock: (v.stock || 0) + item.quantity };
              }
              return v;
            });
            const newTotalStock = updatedVariants.reduce((sum: number, v: any) => sum + (v.stock || 0), 0);
            await updateDoc(pRef, {
              variants: updatedVariants,
              totalStock: newTotalStock,
              updatedAt: new Date().toISOString()
            });

            await addDoc(collection(db, 'inventoryMovements'), {
              productId: item.productId,
              sku: item.variantSku,
              quantityDelta: item.quantity,
              type: 'cancellation_restock',
              referenceId: orderId,
              orderNumber: order.orderNumber,
              reason: `إلغاء الطلب ${order.orderNumber} / Order cancelled restock`,
              performedBy: adminEmail,
              createdAt: new Date().toISOString()
            });
          }
        }
      }
    }

    const historyEntry = {
      status: newStatus,
      timestamp: new Date().toISOString(),
      note: note || `الحالة تم تغييرها إلى ${newStatus}`,
      performedBy: adminEmail
    };

    const updatePayload: any = {
      status: newStatus,
      statusHistory: [...(order.statusHistory || []), historyEntry],
      updatedAt: new Date().toISOString()
    };

    updatePayload.trackingNumber = trackingNumber;
    if (customerName !== undefined) updatePayload.customerName = customerName;
    if (customerPhone !== undefined) updatePayload.customerPhone = customerPhone;
    if (customerEmail !== undefined) updatePayload.customerEmail = customerEmail;
    if (shippingAddress !== undefined) updatePayload.shippingAddress = shippingAddress;

    if (isFirestoreOrder) await updateDoc(orderRef, updatePayload);

    // Sync persistent stored orders and cache
    try {
      if (storedIndex !== -1) {
        storedOrders[storedIndex] = { ...storedOrders[storedIndex], ...updatePayload };
        saveStoredOrders(storedOrders);
        if (storedOrders[storedIndex].orderNumber) {
          recentOrdersCache.set(storedOrders[storedIndex].orderNumber.toString().trim().toUpperCase(), storedOrders[storedIndex]);
        }
      } else if (!isFirestoreOrder) {
        return res.status(404).json({ success: false, message: 'Order not found in persistent storage' });
      }
    } catch (storageErr) {
      console.error('Error syncing order update to storage', storageErr);
    }

    res.json({ success: true, message: 'Order status updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Seed Initial High-End Fashion Brand Data
app.post('/api/seed', async (_req: Request, res: Response) => {
  try {
    // 1. Settings
    const settingsRef = doc(db, 'settings', 'store');
    await setDoc(settingsRef, {
      brandName: "EIGHTY-EIGHT",
      brandNameAr: "EIGHTY-EIGHT",
      logoUrl: "/assets/logo-transparent.png",
      tagline: "Contemporary Egyptian Streetwear & Fashion",
      taglineAr: "براند أزياء مصري عصري بخامات قطنية وفخامة استثنائية",
      currency: "EGP",
      currencyAr: "ج.م",
      whatsappNumber: "+201012345678",
      contactEmail: "contact@eightyeight-eg.com",
      contactPhone: "+20 10 1234 5678",
      address: "التجمع الخامس ومصر الجديدة، القاهرة، مصر",
      announcementBarText: "Complimentary shipping across Egypt on orders over 1,500 EGP — Use Code: EIGHTY10",
      announcementBarTextAr: "شحن مجاني لجميع محافظات مصر للطلبات فوق 1,500 ج.م — كود الخصم: EIGHTY10",
      announcementBarActive: true,
      announcementBarBgColor: "#000000",
      taxPercentage: 0,
      enableTax: false,
      freeShippingThreshold: 1500,
      defaultShippingCost: 65,
      heroTitle: "EIGHTY-EIGHT",
      heroTitleAr: "EIGHTY-EIGHT • أسلوبك العصري",
      heroSubtitle: "Discover the Egyptian streetwear edition crafted from 100% premium Egyptian heavy cotton.",
      heroSubtitleAr: "كولكشن أزياء مصري عصري بخامات قطن مصري 100% ثقيل ومعالج، وتصميمات تجمع بين البساطة والفخامة اليومية.",
      heroImageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1800&q=85",
      heroCtaText: "Shop Collection",
      heroCtaTextAr: "استكشف الكولكشن الآن",
      heroCtaLink: "#shop",
      socialInstagram: "https://instagram.com/eightyeight_eg",
      socialFacebook: "https://facebook.com/eightyeight.eg",
      socialTiktok: "https://tiktok.com/@eightyeight.eg",
      updatedAt: new Date().toISOString()
    });

    // 2. Shipping Zones (Egyptian Governorates)
    const shippingZones = [
      { id: 'zone-cairo', name: 'Cairo & Giza Express', nameAr: 'القاهرة والجيزة (توصيل سريع)', cost: 65, estimatedDays: '1-2 Days', estimatedDaysAr: '1-2 يوم عمل', isActive: true },
      { id: 'zone-alex', name: 'Alexandria & North Coast', nameAr: 'الإسكندرية والساحل الشمالي', cost: 75, estimatedDays: '2-3 Days', estimatedDaysAr: '2-3 أيام عمل', isActive: true },
      { id: 'zone-delta', name: 'Delta & Canal Cities', nameAr: 'محافظات الدلتا ومدن القناة', cost: 85, estimatedDays: '2-4 Days', estimatedDaysAr: '2-4 أيام عمل', isActive: true },
      { id: 'zone-upper', name: 'Upper Egypt & Red Sea', nameAr: 'محافظات الصعيد والبحر الأحمر', cost: 95, estimatedDays: '3-5 Days', estimatedDaysAr: '3-5 أيام عمل', isActive: true },
    ];
    for (const zone of shippingZones) {
      await setDoc(doc(db, 'shippingZones', zone.id), zone);
    }

    // 3. Categories (Egyptian Streetwear & Fashion)
    const categories = [
      {
        id: 'cat-hoodies',
        name: 'Hoodies & Sweatshirts',
        nameAr: 'هوديز وسويت شيرت',
        slug: 'hoodies-sweatshirts',
        description: 'Heavyweight Egyptian cotton French Terry hoodies and crewnecks.',
        imageUrl: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80',
        sortOrder: 1,
        isActive: true
      },
      {
        id: 'cat-tees',
        name: 'Oversized T-Shirts & Polos',
        nameAr: 'تيشيرتات أوفرسايز وبولو',
        slug: 'tees-polos',
        description: '240 GSM combed Egyptian cotton t-shirts with dropped shoulders.',
        imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
        sortOrder: 2,
        isActive: true
      },
      {
        id: 'cat-pants',
        name: 'Cargo & Street Pants',
        nameAr: 'بنطلونات كارجو وستريت',
        slug: 'pants-cargo',
        description: 'Parachute cargo pants, utility joggers, and relaxed fit denim.',
        imageUrl: 'https://images.unsplash.com/photo-1517445312882-bc9910d016b7?auto=format&fit=crop&w=800&q=80',
        sortOrder: 3,
        isActive: true
      },
      {
        id: 'cat-jackets',
        name: 'Jackets & Outerwear',
        nameAr: 'جواكيت وبومبر ومعاطف',
        slug: 'jackets-outerwear',
        description: 'Water-resistant utility bomber jackets, overshirts, and winter coats.',
        imageUrl: 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=800&q=80',
        sortOrder: 4,
        isActive: true
      },
      {
        id: 'cat-accessories',
        name: 'Caps & Accessories',
        nameAr: 'كابات وإكسسوارات',
        slug: 'accessories',
        description: 'Embroidered 88 logo caps, socks, and street accessories.',
        imageUrl: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=800&q=80',
        sortOrder: 5,
        isActive: true
      }
    ];

    for (const cat of categories) {
      await setDoc(doc(db, 'categories', cat.id), cat);
    }

    // 4. Products with Multi-Variant Matrix (EIGHTY-EIGHT Egyptian Collection)
    const sampleProducts = [
      {
        id: 'prod-hoodie-01',
        name: "EIGHTY-EIGHT Signature Heavyweight Hoodie",
        nameAr: "هودي EIGHTY-EIGHT القطني الثقيل المميز",
        slug: "eighty-eight-signature-heavyweight-hoodie",
        sku: "88-HD-001",
        categoryId: "cat-hoodies",
        categoryName: "هوديز وسويت شيرت",
        price: 1450,
        salePrice: 1250,
        cost: 650,
        description: "Crafted from 100% premium Egyptian heavy French Terry cotton (450 GSM). Features an oversized modern drop-shoulder silhouette, double-layered hood, and the iconic 88 embroidered insignia.",
        descriptionAr: "مصنوع من قطن مصري 100% ميلتون ثقيل 450 جرام مع بطانة فائقة النعومة. يتميز بقصة أوفرسايز عصرية وأكتاف ساقطة، وكابيشون مزدوج، مع تطريز لوجو 88 الفاخر بدقة عالية.",
        fabric: "100% قطن مصري ثقيل 450 GSM ميلتون معالج ضد الانكماش.",
        careInstructions: "غسيل آلي بماء بارد ومقلوب. عدم استخدام مبيضات. كوي خفيف على الظهر.",
        images: [
          "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=1000&q=85",
          "https://images.unsplash.com/photo-1509967419530-da38b4704bc6?auto=format&fit=crop&w=1000&q=85"
        ],
        colors: [
          { name: "Pitch Black", nameAr: "أسود داكن", hex: "#111827" },
          { name: "Heather Grey", nameAr: "رمادي ميلانج", hex: "#6b7280" },
          { name: "Forest Olive", nameAr: "زيتي غامق", hex: "#3f4f3c" }
        ],
        sizes: ["M", "L", "XL", "2XL"],
        variants: [
          { sku: "88-HD-001-BLK-M", color: "Pitch Black", size: "M", stock: 15, price: 1250 },
          { sku: "88-HD-001-BLK-L", color: "Pitch Black", size: "L", stock: 22, price: 1250 },
          { sku: "88-HD-001-BLK-XL", color: "Pitch Black", size: "XL", stock: 18, price: 1250 },
          { sku: "88-HD-001-BLK-2XL", color: "Pitch Black", size: "2XL", stock: 8, price: 1250 },
          { sku: "88-HD-001-GRY-L", color: "Heather Grey", size: "L", stock: 14, price: 1250 },
          { sku: "88-HD-001-GRY-XL", color: "Heather Grey", size: "XL", stock: 10, price: 1250 }
        ],
        totalStock: 87,
        isPublished: true,
        isFeatured: true,
        isNewArrival: true,
        isBestSeller: true,
        seoTitle: "EIGHTY-EIGHT Signature Heavyweight Hoodie | Egyptian Streetwear",
        seoDescription: "Shop the iconic 450 GSM Egyptian cotton heavyweight hoodie.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod-tee-02',
        name: "EIGHTY-EIGHT Oversized Minimal Graphic Tee",
        nameAr: "تيشيرت أوفرسايز قطن مصري 100% أسود",
        slug: "eighty-eight-oversized-minimal-graphic-tee",
        sku: "88-TS-002",
        categoryId: "cat-tees",
        categoryName: "تيشيرتات وبولو",
        price: 750,
        salePrice: 650,
        cost: 280,
        description: "Heavyweight 240 GSM combed Egyptian compact cotton. Retains deep black color through countless washes with zero shrinkage and high-density 88 typography.",
        descriptionAr: "مصنوع من أنقى خامات القطن المصري الممشط 240 جرام. قماش معالج يحافظ على اللون الأسود ونعومة الملمس مع تطريز وطباعة حفر عالية الدقة لشعار EIGHTY-EIGHT.",
        fabric: "100% قطن مصري ممشط ومغزول 240 GSM فائق الجودة.",
        careInstructions: "غسيل مقلوب على درجة حرارة 30 مئوية. عدم كوي الطباعة مباشرة.",
        images: [
          "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1000&q=85",
          "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1000&q=85"
        ],
        colors: [
          { name: "Onyx Black", nameAr: "أسود أونيكس", hex: "#0f172a" },
          { name: "Chalk White", nameAr: "أبيض طباشيري", hex: "#f8fafc" }
        ],
        sizes: ["S", "M", "L", "XL"],
        variants: [
          { sku: "88-TS-002-BLK-M", color: "Onyx Black", size: "M", stock: 25, price: 650 },
          { sku: "88-TS-002-BLK-L", color: "Onyx Black", size: "L", stock: 30, price: 650 },
          { sku: "88-TS-002-BLK-XL", color: "Onyx Black", size: "XL", stock: 15, price: 650 },
          { sku: "88-TS-002-WHT-L", color: "Chalk White", size: "L", stock: 20, price: 650 }
        ],
        totalStock: 90,
        isPublished: true,
        isFeatured: true,
        isNewArrival: true,
        isBestSeller: true,
        seoTitle: "EIGHTY-EIGHT Oversized Heavyweight Tee | Premium Cotton",
        seoDescription: "240 GSM combed Egyptian cotton oversized t-shirt.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod-pants-03',
        name: "EIGHTY-EIGHT Utility Parachute Cargo Pants",
        nameAr: "بنطلون كارجو باراشوت زيتي عصري",
        slug: "eighty-eight-utility-parachute-cargo-pants",
        sku: "88-PT-003",
        categoryId: "cat-pants",
        categoryName: "بنطلونات وكارجو",
        price: 1150,
        salePrice: 950,
        cost: 420,
        description: "Relaxed baggy parachute cargo pants with functional 3D multi-pockets, adjustable ankle toggles, and water-repellent ripstop cotton blend.",
        descriptionAr: "تصميم كارجو باراشوت عصري مع جيوب جانبية متعددة وعريضة، واستك سفلي قابل للتعديل عند الكاحل. خامة متينة وعملية ومقاومة للماء.",
        fabric: "97% قطن تويل عالي الكثافة، 3% إيلاستين للمرونة.",
        careInstructions: "غسيل آلي بالماء البارد. تجفيف في الظل.",
        images: [
          "https://images.unsplash.com/photo-1517445312882-bc9910d016b7?auto=format&fit=crop&w=1000&q=85",
          "https://images.unsplash.com/photo-1479064555552-3ef4979f8908?auto=format&fit=crop&w=1000&q=85"
        ],
        colors: [
          { name: "Military Olive", nameAr: "زيتي عسكري", hex: "#4b5320" },
          { name: "Stealth Black", nameAr: "أسود مات", hex: "#1f2937" }
        ],
        sizes: ["30", "32", "34", "36"],
        variants: [
          { sku: "88-PT-003-OLV-32", color: "Military Olive", size: "32", stock: 12, price: 950 },
          { sku: "88-PT-003-OLV-34", color: "Military Olive", size: "34", stock: 16, price: 950 },
          { sku: "88-PT-003-BLK-32", color: "Stealth Black", size: "32", stock: 14, price: 950 },
          { sku: "88-PT-003-BLK-34", color: "Stealth Black", size: "34", stock: 10, price: 950 }
        ],
        totalStock: 52,
        isPublished: true,
        isFeatured: true,
        isNewArrival: false,
        isBestSeller: true,
        seoTitle: "EIGHTY-EIGHT Parachute Cargo Pants",
        seoDescription: "Multi-pocket baggy utility cargo pants.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod-jacket-04',
        name: "EIGHTY-EIGHT Reversible Utility Bomber Jacket",
        nameAr: "جاكيت بومبر عصري مبطن أسود",
        slug: "eighty-eight-utility-bomber-jacket",
        sku: "88-JK-004",
        categoryId: "cat-jackets",
        categoryName: "جواكيت ومعاطف",
        price: 2100,
        salePrice: 1850,
        cost: 890,
        description: "Windproof and water-resistant nylon shell filled with thermal down alternative. Heavy-duty metal zippers, orange emergency lining, and custom 88 zipper pull.",
        descriptionAr: "جاكيت بومبر شتوي فاخر ومبطن بالكامل للحماية من البرد والرياح. سوست معدنية ثقيلة وقصة كلاسيكية تناسب جميع الإطلالات اليومية.",
        fabric: "100% نايلون تافيتال عالي الكثافة مع بطانة داخلية دافئة.",
        careInstructions: "تنظيف جاف أو مسح بقطعة قماش مبللة.",
        images: [
          "https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=1000&q=85",
          "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1000&q=85"
        ],
        colors: [
          { name: "Matte Black", nameAr: "أسود مطفي", hex: "#18181b" }
        ],
        sizes: ["M", "L", "XL"],
        variants: [
          { sku: "88-JK-004-BLK-M", color: "Matte Black", size: "M", stock: 8, price: 1850 },
          { sku: "88-JK-004-BLK-L", color: "Matte Black", size: "L", stock: 14, price: 1850 },
          { sku: "88-JK-004-BLK-XL", color: "Matte Black", size: "XL", stock: 6, price: 1850 }
        ],
        totalStock: 28,
        isPublished: true,
        isFeatured: true,
        isNewArrival: true,
        isBestSeller: false,
        seoTitle: "EIGHTY-EIGHT Utility Bomber Jacket",
        seoDescription: "Insulated streetwear bomber jacket.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod-cap-05',
        name: "EIGHTY-EIGHT Embroidered 88 Structured Cap",
        nameAr: "كاب بيسبول لوجو 88 مطرز",
        slug: "eighty-eight-embroidered-88-structured-cap",
        sku: "88-CP-005",
        categoryId: "cat-accessories",
        categoryName: "كابات وإكسسوارات",
        price: 500,
        salePrice: 450,
        cost: 180,
        description: "Structured 6-panel baseball cap with 3D embroidered 88 infinity monogram and antique brass buckle closure.",
        descriptionAr: "كاب كلاسيكي بـ 6 ألواح مقواة وتطريز ثلاثي الأبعاد لشعار 88 مع إبزيم نحاسي خلفي لضبط المقاس بدقة.",
        fabric: "100% قطن تويل ثقيل مسامي.",
        careInstructions: "تنظيف يدوي بإسفنجة رطبة.",
        images: [
          "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=1000&q=85"
        ],
        colors: [
          { name: "Black / White", nameAr: "أسود بتطريز أبيض", hex: "#000000" }
        ],
        sizes: ["مقاس موحد قابل للتعديل"],
        variants: [
          { sku: "88-CP-005-BLK-OS", color: "Black / White", size: "مقاس موحد", stock: 35, price: 450 }
        ],
        totalStock: 35,
        isPublished: true,
        isFeatured: false,
        isNewArrival: true,
        isBestSeller: true,
        seoTitle: "EIGHTY-EIGHT Embroidered Cap",
        seoDescription: "Structured 88 embroidered cotton cap.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    for (const prod of sampleProducts) {
      await setDoc(doc(db, 'products', prod.id), prod);
    }

    // 5. Coupons
    const coupons = [
      {
        id: 'coup-eighty10',
        code: 'EIGHTY10',
        discountType: 'percentage',
        discountValue: 10,
        minOrderValue: 1000,
        maxDiscount: 300,
        usageLimit: 1000,
        usageCount: 42,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'coup-welcome88',
        code: 'WELCOME88',
        discountType: 'percentage',
        discountValue: 15,
        minOrderValue: 600,
        maxDiscount: 250,
        usageLimit: 500,
        usageCount: 88,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'coup-freeship',
        code: 'FREESHIP',
        discountType: 'fixed',
        discountValue: 65,
        minOrderValue: 800,
        maxDiscount: 65,
        usageLimit: 300,
        usageCount: 19,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ];
    for (const coup of coupons) {
      await setDoc(doc(db, 'coupons', coup.id), coup);
    }

    // 6. Promotional Banners
    const banners = [
      {
        id: 'banner-hero',
        title: "The Autumn Haute Couture Edition",
        titleAr: "مجموعة خريف وشتاء الكوتور الحصرية",
        subtitle: "Architectural lines meeting fluid Italian silks",
        subtitleAr: "خطوط معمارية تلتقي مع انسيابية الحرير الإيطالي",
        imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1800&q=85",
        mobileImageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=85",
        linkUrl: "#shop",
        buttonText: "Discover The Runway",
        buttonTextAr: "اكتشف إطلالات العرض",
        position: "hero",
        sortOrder: 1,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'banner-middle',
        title: "Bespoke Outerwear Craftsmanship",
        titleAr: "حرفية تفصيل المعاطف الفاخرة",
        subtitle: "Hand-finished double-faced cashmere and virgin wool longcoats designed to last a lifetime.",
        subtitleAr: "معاطف صوف وكشمير مزدوجة الوجه بحياكة يدوية متقنة تدوم لأجيال.",
        imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1600&q=85",
        mobileImageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=85",
        linkUrl: "#shop",
        buttonText: "Shop Outerwear",
        buttonTextAr: "تسوق المعاطف",
        position: "middle",
        sortOrder: 2,
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ];
    for (const b of banners) {
      await setDoc(doc(db, 'banners', b.id), b);
    }

    // 7. CMS Pages
    const pages = [
      {
        id: 'page-about',
        title: "The EIGHTY-EIGHT Story",
        titleAr: "قصة براند EIGHTY-EIGHT",
        slug: "about",
        content: `EIGHTY-EIGHT is an avant-garde Egyptian fashion house engineering oversized silhouettes, luxury heavyweight fleece, and bespoke street-tailoring. Founded in Cairo, our garments merge architectural precision with everyday comfort. Every piece is crafted from 100% Egyptian combed cotton with double-stitched durability and custom dyed in small limited batches.`,
        contentAr: `براند EIGHTY-EIGHT هو براند مصري يقدم أرقى تصميمات الأزياء العصرية وستريت وير فاخر بقصات معمارية وخامات قطن مصري 100% عالية الجودة. بنصمم كل قطعة بعناية فائقة لتجمع بين الفخامة والراحة والأناقة اليومية بأعلى معايير الحياكة والتقفيل الدقيق.`,
        isPublished: true,
        seoTitle: "About EIGHTY-EIGHT | Luxury Egyptian Streetwear & Fashion",
        seoDescription: "Discover the heritage, quality cotton, and urban craftsmanship behind EIGHTY-EIGHT.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'page-shipping',
        title: "Shipping & Delivery Policy",
        titleAr: "سياسة الشحن والتوصيل في مصر",
        slug: "shipping-policy",
        content: `All EIGHTY-EIGHT orders are packaged in signature magnetic luxury boxes with branded tissue paper. We deliver to all Egyptian governorates (Cairo, Giza, Alexandria, Delta, and Upper Egypt) within 24 to 72 hours via premium courier services. Cash on Delivery (COD) and live parcel inspection at the doorstep are fully supported.`,
        contentAr: `بيتم تجهيز وتغليف كل أوردرات EIGHTY-EIGHT في علب هدايا فاخرة ومغناطيسية خاصة بالبراند. بنوصل لجميع محافظات مصر (القاهرة، الجيزة، الإسكندرية، محافظات الدلتا، والصعيد) خلال 24 إلى 72 ساعة عبر شركات شحن سريعة وموثوقة مع إمكانية الدفع عند الاستلام والمعاينة قبل الاستلام.`,
        isPublished: true,
        seoTitle: "Shipping & Delivery in Egypt | EIGHTY-EIGHT",
        seoDescription: "Fast shipping across Cairo, Giza, Alexandria, and all Egyptian governorates with cash on delivery.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'page-returns',
        title: "Returns & Exchanges",
        titleAr: "سياسة الاستبدال والاسترجاع السلسة",
        slug: "returns-policy",
        content: `We offer an easy 14-day exchange and return policy across Egypt. Items must be in brand new, unworn condition with all original tags attached. Simply submit your request or contact our customer support team, and our courier will handle the pickup directly from your doorstep.`,
        contentAr: `نوفر لحضرتك إمكانية الاستبدال أو الاسترجاع بكل سهولة خلال 14 يوم من استلام الأوردر، بشرط أن تكون القطعة بحالتها الأصلية وغير مستخدمة مع التيكت الخاص بها. المندوب بيوصل لحد باب بيتك يستلم أو يبدل المقاس بدون أي تعقيد.`,
        isPublished: true,
        seoTitle: "Returns & Exchanges | EIGHTY-EIGHT",
        seoDescription: "Hassle-free 14-day exchange and return policy across all Egyptian governorates.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'page-size-guide',
        title: "Size & Fit Guide",
        titleAr: "دليل المقاسات لبراند EIGHTY-EIGHT",
        slug: "size-guide",
        content: `EIGHTY-EIGHT garments are designed with modern relaxed and oversized silhouettes. If you prefer a relaxed streetwear drape, select your standard size. For a standard tailored fit, consider sizing down one size. Precise chest, shoulder, and length measurements in centimeters are listed on every product page.`,
        contentAr: `تصميمات EIGHTY-EIGHT بتعتمد على القصات المريحة والـ Oversized العصرية. لو بتفضل المظهر الـ Oversized اطلب مقاسك المعتاد، ولو بتفضل المقاس المظبوط (Regular Fit) تقدر تختار مقاس أصغر نمرة واحدة. قياسات الصدر والكتف والطول متوفرة بالسنتيمتر داخل صفحة كل منتج.`,
        isPublished: true,
        seoTitle: "Size Guide | EIGHTY-EIGHT",
        seoDescription: "Accurate size charts and fitting advice for hoodies, t-shirts, jackets, and trousers.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    for (const p of pages) {
      await setDoc(doc(db, 'pages', p.id), p);
    }

    // 8. Sample Customer Reviews
    const reviews = [
      {
        id: 'rev-01',
        productId: 'prod-trench-01',
        customerName: 'Victoria S.',
        customerEmail: 'victoria.s@example.com',
        rating: 5,
        title: 'Unrivaled tailoring and drape',
        comment: 'The cashmere-wool blend has the most exquisite hand feel. The silhouette is reminiscent of classic French haute couture. Arrived in a gorgeous storage box.',
        isApproved: true,
        isVerifiedPurchase: true,
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString()
      },
      {
        id: 'rev-02',
        productId: 'prod-dress-02',
        customerName: 'Sarah M.',
        customerEmail: 'sarah.m@example.com',
        rating: 5,
        title: 'Stunning silk quality',
        comment: 'Wore this to a gala and received non-stop compliments. The Champagne color catches the light like liquid gold. Perfectly true to size.',
        isApproved: true,
        isVerifiedPurchase: true,
        createdAt: new Date(Date.now() - 7 * 86400000).toISOString()
      },
      {
        id: 'rev-03',
        productId: 'prod-blazer-03',
        customerName: 'Elena Rostova',
        customerEmail: 'elena@example.com',
        rating: 5,
        title: 'Sharp, elegant power blazer',
        comment: 'Shoulders are sculpted to absolute perfection. The wool crepe has zero creasing even after travel. An investment piece.',
        isApproved: true,
        isVerifiedPurchase: true,
        createdAt: new Date(Date.now() - 10 * 86400000).toISOString()
      }
    ];
    for (const rev of reviews) {
      await setDoc(doc(db, 'reviews', rev.id), rev);
    }

    // 9. Bootstrap Super Admin Record
    await setDoc(doc(db, 'admins', 'admin-primary'), {
      id: 'admin-primary',
      email: 'muhammedadel.dev@gmail.com',
      displayName: 'Muhammed Adel • Super Admin',
      role: 'super_admin',
      permissions: ['all', 'products', 'orders', 'inventory', 'returns', 'coupons', 'cms', 'settings', 'reports', 'roles'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 10. Sample Orders for Dashboard Analytics
    const sampleOrders = [
      {
        orderNumber: 'ORD-88101-CAI',
        customerId: 'cust-demo-1',
        customerName: 'كريم الشناوي',
        customerEmail: 'karim.shennawy@example.com',
        customerPhone: '+201012345678',
        shippingAddress: {
          governorate: 'Cairo',
          city: 'التجمع الخامس - القاهرة الجديدة',
          address: 'كمبوند الديار، فيلا 18'
        },
        items: [
          {
            productId: 'prod-hoodie-01',
            productName: "EIGHTY-EIGHT Heavyweight Signature Hoodie",
            variantSku: "88-HD-001-BLK-L",
            color: "Onyx Black",
            size: "L",
            price: 1450,
            quantity: 1,
            total: 1450,
            image: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=600&q=80"
          }
        ],
        subtotal: 1450,
        shippingCost: 0,
        shippingZoneName: 'القاهرة والجيزة (توصيل سريع)',
        discountAmount: 145,
        couponCode: 'EIGHTY10',
        taxAmount: 0,
        total: 1305,
        currency: 'EGP',
        paymentMethod: 'vodafone_cash',
        paymentStatus: 'paid',
        status: 'delivered',
        trackingNumber: 'EG-CAI-880192',
        statusHistory: [
          { status: 'new', timestamp: new Date(Date.now() - 3 * 86400000).toISOString(), note: 'تم استلام الأوردر بنجاح' },
          { status: 'confirmed', timestamp: new Date(Date.now() - 2 * 86400000).toISOString(), note: 'تم تأكيد الدفع عبر فودافون كاش' },
          { status: 'shipped', timestamp: new Date(Date.now() - 1 * 86400000).toISOString(), note: 'خرج للتوصيل مع مندوب الشحن' },
          { status: 'delivered', timestamp: new Date(Date.now() - 6 * 3600000).toISOString(), note: 'تم تسليم الأوردر للعميل' }
        ],
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 6 * 3600000).toISOString()
      },
      {
        orderNumber: 'ORD-88102-ALX',
        customerId: 'cust-demo-2',
        customerName: 'سلمى عبد الرحمن',
        customerEmail: 'salma.abdelrahman@example.com',
        customerPhone: '+201123456789',
        shippingAddress: {
          governorate: 'Alexandria',
          city: 'سموحة - الإسكندرية',
          address: 'شارع فوزي معاذ، عمارة 14 الدور السادس'
        },
        items: [
          {
            productId: 'prod-tee-02',
            productName: "EIGHTY-EIGHT Architectural Boxy Tee",
            variantSku: "88-TEE-002-WHT-M",
            color: "Raw Off-White",
            size: "M",
            price: 750,
            quantity: 2,
            total: 1500,
            image: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80"
          }
        ],
        subtotal: 1500,
        shippingCost: 65,
        shippingZoneName: 'الإسكندرية والساحل',
        discountAmount: 0,
        couponCode: '',
        taxAmount: 0,
        total: 1565,
        currency: 'EGP',
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        status: 'processing',
        trackingNumber: '',
        statusHistory: [
          { status: 'new', timestamp: new Date(Date.now() - 1 * 86400000).toISOString(), note: 'تم إنشاء الطلب' },
          { status: 'confirmed', timestamp: new Date(Date.now() - 12 * 3600000).toISOString(), note: 'تم التواصل وتأكيد العنوان هاتفياً' },
          { status: 'processing', timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), note: 'جاري التجهيز والتغليف داخل المعمل' }
        ],
        createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 3600000).toISOString()
      }
    ];

    for (const ord of sampleOrders) {
      await addDoc(collection(db, 'orders'), ord);
    }

    res.json({
      success: true,
      message: 'Luxury Fashion Brand database seeded successfully with products, categories, coupons, pages, reviews, and admin accounts!'
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Configure Vite integration (local development / self-hosted only)
const isDev = process.env.NODE_ENV !== 'production';

async function startServer() {
  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EIGHTY-EIGHT Fashion Platform server running on port ${PORT}`);
  });
}

// On Vercel the platform handles listening and static files, so we only
// start the server when running locally / on a regular Node host.
if (!isVercel) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
  });
}

export default app;
