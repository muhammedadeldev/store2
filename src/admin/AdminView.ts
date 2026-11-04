/**
 * L'ÉTOILE Haute Couture & Fashion Platform
 * Admin Dashboard - Production Management System
 * Pure Vanilla JavaScript ES6+ & CSS3 with Cairo Typography & Full Arabic UI
 */

import { state, showToast, openModal, closeModal } from '../state';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db, auth, googleProvider } from '../firebase';
import { signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';

// Convert every static image to WebP before uploading. Keeping the result below
// this size also leaves headroom for Base64 and JSON overhead on Vercel.
const MAX_UPLOAD_IMAGE_BYTES = 2.75 * 1024 * 1024;

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('تعذر قراءة الصورة'));
    reader.onerror = () => reject(reader.error || new Error('تعذر قراءة الصورة'));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob
      ? resolve(blob)
      : reject(new Error('تعذر ضغط الصورة في المتصفح')), type, quality);
  });
}

async function prepareImageForUpload(file: File): Promise<{ data: string; type: string }> {
  if (file.type === 'image/gif') {
    throw new Error('للحفاظ على حركة GIF، ارفعها كصورة ثابتة بصيغة JPG أو PNG أو WebP بدلاً منها.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('تعذر تجهيز الصورة. جرّب حفظها بصيغة JPG أو PNG أو WebP.');
  }

  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('المتصفح لا يدعم ضغط الصور');

    const sourceEdge = Math.max(bitmap.width, bitmap.height);
    for (const maxEdge of [1920, 1600, 1344, 1128, 960, 768]) {
      const scale = Math.min(1, maxEdge / sourceEdge);
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.82, 0.72, 0.62, 0.52]) {
        const blob = await canvasToBlob(canvas, 'image/webp', quality);
        if (blob.type !== 'image/webp') {
          throw new Error('المتصفح لا يدعم تحويل الصور إلى WebP. جرّب استخدام متصفح حديث.');
        }
        if (blob.size <= MAX_UPLOAD_IMAGE_BYTES) {
          return { data: await readBlobAsDataUrl(blob), type: blob.type || 'image/webp' };
        }
      }
    }
  } finally {
    bitmap.close();
  }

  throw new Error('حجم الصورة ما زال كبيراً بعد الضغط. اختر صورة أصغر أو قلّل أبعادها.');
}

// Helper: convert static images to WebP locally, then upload to /api/upload.
async function uploadImageFile(file: File): Promise<{ url: string; filename: string }> {
  const prepared = await prepareImageForUpload(file);
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: file.name,
      data: prepared.data,
      type: prepared.type
    })
  });

  const resData = await res.json();
  if (resData.success) {
    return { url: resData.url, filename: resData.filename };
  }
  throw new Error(resData.message || `فشل رفع الصورة (${res.status})`);
}

function bindImageUploadControls(root: ParentNode = document) {
  root.querySelectorAll<HTMLInputElement>('[data-image-upload-for]').forEach(fileInput => {
    if (fileInput.dataset.imageUploadBound === 'true') return;
    fileInput.dataset.imageUploadBound = 'true';
    fileInput.onchange = async () => {
      const files = Array.from(fileInput.files || []);
      if (!files.length) return;

      const targetId = fileInput.dataset.imageUploadFor;
      const target = targetId ? document.getElementById(targetId) as HTMLInputElement | HTMLTextAreaElement | null : null;
      if (!target) {
        showToast('تعذر العثور على حقل الصورة في النموذج', 'error');
        return;
      }

      const appendLines = fileInput.dataset.imageUploadMode === 'append-lines';
      const previewId = fileInput.dataset.imagePreview;
      const preview = previewId ? document.getElementById(previewId) as HTMLImageElement | null : null;
      const previewBoxId = fileInput.dataset.imagePreviewBox;
      const previewBox = previewBoxId ? document.getElementById(previewBoxId) as HTMLElement | null : null;

      try {
        showToast(files.length > 1 ? `جاري رفع ${files.length} صورة...` : 'جاري رفع الصورة...', 'info');
        const urls: string[] = [];
        for (const file of files) {
          const uploaded = await uploadImageFile(file);
          urls.push(uploaded.url);
        }

        if (appendLines) {
          target.value = [...target.value.split('\n').map(value => value.trim()).filter(Boolean), ...urls].join('\n');
        } else {
          target.value = urls[0];
          if (preview) preview.src = urls[0];
          if (previewBox) previewBox.style.display = 'block';
        }
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        showToast(files.length > 1 ? 'تم رفع الصور وربطها بنجاح' : 'تم رفع الصورة وربطها بنجاح', 'success');
      } catch (err: any) {
        showToast(err.message || 'تعذر رفع الصورة', 'error');
      } finally {
        fileInput.value = '';
      }
    };
  });
}

interface AdminCache {
  timestamp: number;
  orders: any[];
  products: any[];
  categories: any[];
  returns: any[];
  coupons: any[];
  reviews: any[];
  shippingZones: any[];
  inventoryMovements: any[];
  mediaItems: any[];
  pages: any[];
  settings: any;
}
let adminCache: AdminCache | null = null;

export function invalidateAdminCache() {
  adminCache = null;
}

function refreshAdminSection(section: string) {
  invalidateAdminCache();
  const nextHash = `#admin/${section}?updated=${Date.now()}`;
  window.location.hash = nextHash;
}

function parseProductColors(raw: string): Array<{ name: string; hex: string }> {
  return raw.split(/\n|,/).map(item => item.trim()).filter(Boolean).map(item => {
    const [name, hex] = item.split('|').map(v => v.trim());
    return { name: name || 'Color', hex: hex || '#111827' };
  });
}

function buildProductVariants(sku: string, sizes: string[], colors: Array<{ name: string; hex: string }>, stock: number) {
  const combinations = sizes.flatMap(size => colors.map(color => ({ size, color: color.name })));
  const each = combinations.length ? Math.floor(stock / combinations.length) : 0;
  let remainder = combinations.length ? stock - each * combinations.length : 0;
  return combinations.map((variant, index) => ({
    sku: `${sku}-${variant.color.replace(/\s+/g, '-').toUpperCase()}-${variant.size}`,
    color: variant.color,
    size: variant.size,
    stock: each + (index < remainder ? 1 : 0)
  }));
}

const CMS_CONTENT_GROUPS: Array<{ title: string; fields: Array<{ key: string; label: string; fallback: string; multiline?: boolean }> }> = [
  { title: 'الهيدر والتنقل', fields: [
    { key: 'header.tagline.ar', label: 'وصف البراند في القائمة (عربي)', fallback: 'ستريت وير مصري معاصر' },
    { key: 'header.tagline.en', label: 'وصف البراند في القائمة (إنجليزي)', fallback: 'Contemporary Egyptian streetwear' },
    ...(['home', 'shop', 'new', 'best', 'track', 'about'] as const).flatMap((name, i) => {
      const labels = [
        ['الرئيسية', 'Home'], ['المتجر والمنتجات', 'Shop'], ['وصل حديثاً', 'New Arrivals'],
        ['الأكثر مبيعاً', 'Best Sellers'], ['تتبع شحنتك', 'Track Order'], ['عن البراند', 'About']
      ][i];
      return [
        { key: `header.nav.${name}.ar`, label: `اسم رابط الهيدر ${labels[0]} (عربي)`, fallback: labels[0] },
        { key: `header.nav.${name}.en`, label: `اسم رابط الهيدر ${labels[1]} (إنجليزي)`, fallback: labels[1] },
        { key: `header.nav.${name}.href`, label: `رابط الهيدر ${labels[0]}`, fallback: ['#home', '#shop', '#shop?filter=new', '#shop?filter=bestseller', '#track', '#page/about'][i] }
      ];
    }),
    { key: 'header.mobile.navigation.ar', label: 'عنوان قائمة الموبايل (عربي)', fallback: 'التنقل الرئيسي' },
    { key: 'header.mobile.navigation.en', label: 'عنوان قائمة الموبايل (إنجليزي)', fallback: 'Navigation' },
    { key: 'header.mobile.collections.ar', label: 'عنوان تصنيفات الموبايل (عربي)', fallback: 'أقسام الكولكشن' },
    { key: 'header.mobile.collections.en', label: 'عنوان تصنيفات الموبايل (إنجليزي)', fallback: 'Collections' },
    { key: 'header.mobile.customerCare.ar', label: 'عنوان خدمة العملاء (عربي)', fallback: 'خدمة العملاء وحسابي' },
    { key: 'header.mobile.customerCare.en', label: 'عنوان خدمة العملاء (إنجليزي)', fallback: 'Customer Care' },
    ...(['all', 'one', 'two', 'three', 'four'] as const).flatMap((name, i) => {
      const labels = [['الكل', 'All'], ['هوديز وسويت شيرت', 'Hoodies & Sweatshirts'], ['تيشيرتات وبولو', 'T-Shirts & Polos'], ['بنطلونات وكارجو', 'Pants & Cargo'], ['كابات وإكسسوارات', 'Caps & Accessories']][i];
      return [
        { key: `header.category.${name}.ar`, label: `تصنيف الهيدر ${i + 1} (عربي)`, fallback: labels[0] },
        { key: `header.category.${name}.en`, label: `تصنيف الهيدر ${i + 1} (إنجليزي)`, fallback: labels[1] },
        { key: `header.category.${name}.href`, label: `رابط تصنيف الهيدر ${i + 1}`, fallback: '#shop' }
      ];
    }),
    ...([
      ['account', 'حسابي', 'Account', '#account'], ['wishlist', 'المفضلة', 'Wishlist', '#account?tab=wishlist'],
      ['size', 'دليل المقاسات', 'Size Guide', '#page/size-guide'], ['shipping', 'الشحن والتوصيل للمحافظات', 'Shipping Policy', '#page/shipping-policy'],
      ['returns', 'الاسترجاع والاستبدال (14 يوم)', 'Returns & Exchange', '#page/returns-policy'], ['about', 'عن البراند', 'About', '#page/about']
    ] as const).flatMap(([name, ar, en, href]) => [
      { key: `header.mobile.${name}.ar`, label: `رابط الموبايل: ${ar} (عربي)`, fallback: ar },
      { key: `header.mobile.${name}.en`, label: `رابط الموبايل: ${ar} (إنجليزي)`, fallback: en },
      { key: `header.mobile.${name}.href`, label: `رابط الموبايل: ${ar}`, fallback: href }
    ]),
    ...([
      ['home', 'الرئيسية', 'Home', '#home'], ['shop', 'المتجر', 'Shop', '#shop'],
      ['track', 'تتبع الشحنة', 'Track', '#track'], ['account', 'حسابي', 'Account', '#account'], ['cart', 'السلة', 'Cart', '#cart']
    ] as const).flatMap(([name, ar, en, href]) => [
      { key: `header.bottom.${name}.ar`, label: `شريط الموبايل السفلي ${ar} (عربي)`, fallback: ar },
      { key: `header.bottom.${name}.en`, label: `شريط الموبايل السفلي ${ar} (إنجليزي)`, fallback: en },
      { key: `header.bottom.${name}.href`, label: `رابط شريط الموبايل السفلي ${ar}`, fallback: href }
    ]),
    { key: 'header.whatsapp.ar', label: 'زر واتساب (عربي)', fallback: 'تواصل معنا واتساب مباشر' },
    { key: 'header.whatsapp.en', label: 'زر واتساب (إنجليزي)', fallback: 'Chat with us on WhatsApp' }
  ] },
  { title: 'نصوص الصفحة الرئيسية والمزايا', fields: [
    ...([1, 2, 3, 4] as const).flatMap((n) => [
      { key: `home.pillar${n}.title.ar`, label: `الميزة ${n} — العنوان (عربي)`, fallback: ['خامات طبيعية نقية 100%', 'حرفية آتيليه يدوية', 'شحن سريع لجميع المحافظات', 'إرجاع واستبدال مجاني'][n - 1] },
      { key: `home.pillar${n}.title.en`, label: `الميزة ${n} — العنوان (إنجليزي)`, fallback: ['Noble Fibers', 'Atelier Craft', 'Fast Express Across Egypt', '14-Day Returns'][n - 1] },
      { key: `home.pillar${n}.description.ar`, label: `الميزة ${n} — الوصف (عربي)`, fallback: ['كشمير منغولي وحرير التوت الإيطالي', 'حياكة دقيقة وقصات باريسية متقنة', 'توصيل مجاني للطلبات فوق 1,500 ج.م', 'استبدال واسترجاع سلس بدون عناء'][n - 1] },
      { key: `home.pillar${n}.description.en`, label: `الميزة ${n} — الوصف (إنجليزي)`, fallback: ['Mongolian cashmere & Mulberry silk', 'Parisian cuts & artisanal finishing', 'Free express on orders over 1,500 EGP', 'Effortless courier pick-up'][n - 1] }
    ]),
    ...([
      ['collections.eyebrow', 'عنوان المجموعات الصغير', 'المجموعات والتصنيفات', 'The Curations'],
      ['collections.title', 'عنوان المجموعات', 'المجموعات والتصنيفات الفاخرة', 'Signature Collections'],
      ['collections.link', 'رابط جميع المجموعات', 'عرض كل التصنيفات ←', 'View All Collections →'],
      ['collections.discover', 'رابط اكتشاف التصنيف', 'اكتشف القطع ←', 'Discover Pieces →'],
      ['arrivals.eyebrow', 'عنوان المنتجات الجديدة الصغير', 'إبداعات الموسم', 'Runway Highlights'],
      ['arrivals.description', 'وصف المنتجات الجديدة', 'قطع حصرية محدودة الإصدار تم قصها وتفصيلها بأعلى معايير الهوت كوتور.', 'Limited atelier pieces cut and hand-finished with timeless contemporary proportions.'],
      ['arrivals.link', 'زر المنتجات الجديدة', 'استعراض كامل التشكيلة', 'View Full Ready-to-Wear'],
      ['story.eyebrow', 'عنوان قصة البراند الصغير', 'فلسفة المتجر والإنتاج', 'The Brand Craft'],
      ['story.title', 'عنوان قصة البراند', 'خياطة معمارية دقيقة لا تعترف بمرور الزمن', 'Sculptural Tailoring Built For A Lifetime'],
      ['story.link', 'رابط قصة البراند', 'قراءة قصة المتجر الكاملة', 'Read Store Story'],
      ['bestsellers.eyebrow', 'عنوان الأكثر مبيعاً الصغير', 'القطع الأيقونية', 'The Icons'],
      ['bestsellers.link', 'رابط الأكثر مبيعاً', 'عرض الأكثر طلباً ←', 'View All Best Sellers'],
      ['social.title', 'عنوان معرض الصور', 'إطلالات الكوتور في العالم', 'Worn Across The Globe'],
      ['arrivals.title', 'عنوان قسم المنتجات الجديدة', 'وصل حديثاً', 'New Arrivals'],
      ['bestsellers.title', 'عنوان قسم الأكثر مبيعاً', 'الأكثر مبيعاً', 'Best Sellers']
    ] as const).flatMap(([name, label, ar, en]) => [
      { key: `home.${name}.ar`, label: `${label} (عربي)`, fallback: ar },
      { key: `home.${name}.en`, label: `${label} (إنجليزي)`, fallback: en }
    ]),
    { key: 'home.story.body1.ar', label: 'قصة البراند — الفقرة الأولى (عربي)', fallback: 'في براند EIGHTY-EIGHT، نؤمن بأن الأناقة الحقيقية تنبع من نقاء القماش والقصة المثالية. نعتمد فقط على القطن المصري 100% الثقيل والمعالج لضمان الراحة التامة والمتانة الاستثنائية.', multiline: true },
    { key: 'home.story.body1.en', label: 'قصة البراند — الفقرة الأولى (إنجليزي)', fallback: 'At EIGHTY-EIGHT, true streetwear luxury resides in the purity of proportion and the integrity of 100% premium Egyptian heavy cotton.', multiline: true },
    { key: 'home.story.body2.ar', label: 'قصة البراند — الفقرة الثانية (عربي)', fallback: 'كل تصميم يخضع لعشرات الساعات من التعديل اليدوي للتأكد من انسيابيته مع حركة الجسد.', multiline: true },
    { key: 'home.story.body2.en', label: 'قصة البراند — الفقرة الثانية (إنجليزي)', fallback: 'Every piece undergoes rigorous hand draping and tailoring to guarantee an effortless fluid drape.', multiline: true },
    { key: 'home.story.imageAlt.ar', label: 'وصف صورة قصة البراند (عربي)', fallback: 'قصة وحرفية البراند' },
    { key: 'home.story.imageAlt.en', label: 'وصف صورة قصة البراند (إنجليزي)', fallback: 'Atelier Craft' },
    { key: 'home.social.handle', label: 'اسم حساب التواصل في معرض الصور', fallback: '@letoile_official' },
    { key: 'home.story.image', label: 'صورة قصة البراند', fallback: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=85' },
    { key: 'home.collections.link.href', label: 'رابط جميع التصنيفات في الرئيسية', fallback: '#shop' },
    { key: 'home.arrivals.link.href', label: 'رابط زر التشكيلة الجديدة', fallback: '#shop' },
    { key: 'home.story.link.href', label: 'رابط قصة البراند في الرئيسية', fallback: '#page/about' },
    { key: 'home.bestsellers.link.href', label: 'رابط الأكثر مبيعاً في الرئيسية', fallback: '#shop?filter=bestseller' },
    ...([1, 2, 3, 4, 5] as const).map((i) => ({ key: `home.social.image.${i}`, label: `صورة معرض التواصل ${i}`, fallback: [
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1548624149-f9b1859aa9d0?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=600&q=80'
    ][i - 1] }))
  ] },
  { title: 'صفحات الموقع الثابتة', fields: [
    { key: 'page.about.title.ar', label: 'عنوان صفحة عن البراند (عربي)', fallback: 'قصة المتجر والحرفية' },
    { key: 'page.about.title.en', label: 'عنوان صفحة عن البراند (إنجليزي)', fallback: 'The EIGHTY-EIGHT Story' },
    { key: 'page.about.content.ar', label: 'محتوى صفحة عن البراند (عربي)', fallback: 'تأسس متجر EIGHTY-EIGHT انطلاقاً من شغف استثنائي بنقاء خامات القطن المصري 100% ودقة الخطوط التصميمية لتصل بالستريت وير المصري إلى أعلى معايير الجودة العالمية. بنصمم كل قطعة بعناية فائقة لتجمع بين الفخامة والراحة والأناقة اليومية مع تقفيل دقيق يدوم طويلاً.', multiline: true },
    { key: 'page.about.content.en', label: 'محتوى صفحة عن البراند (إنجليزي)', fallback: 'Founded with an uncompromising devotion to fabric integrity and architectural silhouettes, EIGHTY-EIGHT represents modern Egyptian streetwear elevated to luxury standards. Every garment is crafted from 100% combed heavy Egyptian cotton, engineered for lasting comfort and durability.', multiline: true },
    { key: 'page.heading.ar', label: 'عنوان قسم صفحات المتجر (عربي)', fallback: 'صفحات ومعلومات المتجر' },
    { key: 'page.heading.en', label: 'عنوان قسم صفحات المتجر (إنجليزي)', fallback: 'Store Documentation' },
    { key: 'page.shopButton.ar', label: 'زر العودة للمتجر (عربي)', fallback: 'استعراض تشكيلة المتجر' },
    { key: 'page.shopButton.en', label: 'زر العودة للمتجر (إنجليزي)', fallback: 'Explore Current Collection' },
    { key: 'page.shopButton.href', label: 'رابط زر العودة للمتجر', fallback: '#shop' },
    { key: 'page.whatsappButton.ar', label: 'زر واتساب بالصفحات (عربي)', fallback: 'محادثة خدمة عملاء المتجر (واتساب)' },
    { key: 'page.whatsappButton.en', label: 'زر واتساب بالصفحات (إنجليزي)', fallback: 'Chat with Store Support (WhatsApp)' },
    { key: 'page.whatsappButton.href', label: 'رابط زر واتساب بالصفحات', fallback: 'whatsapp' },
    { key: 'page.notFound.ar', label: 'رسالة الصفحة غير الموجودة (عربي)', fallback: 'الصفحة غير موجودة' },
    { key: 'page.notFound.en', label: 'رسالة الصفحة غير الموجودة (إنجليزي)', fallback: 'Page Not Found' }
  ] },
  { title: 'الفوتر والتواصل', fields: [
    { key: 'footer.brandDescription.ar', label: 'وصف البراند في الفوتر (عربي)', fallback: 'براند أزياء مصري عصري بخامات قطن مصري 100% وتصميمات عصرية راقية تجمع بين الراحة والفخامة اليومية.', multiline: true },
    { key: 'footer.brandDescription.en', label: 'وصف البراند في الفوتر (إنجليزي)', fallback: 'Contemporary Egyptian streetwear & fashion crafted from noble 100% Egyptian cotton fibers.', multiline: true },
    ...([
      ['collections.title', 'عنوان قسم التصنيفات', 'أقسام الكولكشن', 'Collections'],
      ['care.title', 'عنوان خدمة العملاء', 'خدمة العملاء والسياسات', 'Client Care'],
      ['newsletter.title', 'عنوان النشرة البريدية', 'انضم لنادي EIGHTY-EIGHT', 'Join EIGHTY-EIGHT'],
      ['newsletter.description', 'وصف النشرة البريدية', 'اشترك لتصلك أحدث القطع قبل نزولها وكوبونات خصم حصرية للأعضاء.', 'Subscribe for exclusive runway drops, VIP discounts, and early access.'],
      ['newsletter.placeholder', 'حقل البريد الإلكتروني', 'اكتب بريدك الإلكتروني...', 'Your email address...'],
      ['newsletter.button', 'زر الاشتراك', 'اشتراك', 'Join']
    ] as const).flatMap(([name, label, ar, en]) => [
      { key: `footer.${name}.ar`, label: `${label} (عربي)`, fallback: ar },
      { key: `footer.${name}.en`, label: `${label} (إنجليزي)`, fallback: en }
    ]),
    ...([
      ['collections.all', 'جميع المنتجات', 'All Products', '#shop'],
      ['collections.new', 'وصل حديثاً', 'New Arrivals', '#shop?filter=new'],
      ['collections.best', 'الأكثر مبيعاً', 'Best Sellers', '#shop?filter=bestseller'],
      ['collections.one', 'هوديز وسويت شيرت', 'Hoodies & Sweatshirts', '#shop'],
      ['collections.two', 'تيشيرتات وبولو', 'T-Shirts & Polos', '#shop'],
      ['collections.three', 'بنطلونات وكارجو', 'Pants & Cargo', '#shop'],
      ['care.track', 'تتبع شحنتك', 'Track Order', '#track'],
      ['care.size', 'دليل المقاسات', 'Size Guide', '#page/size-guide'],
      ['care.shipping', 'الشحن والتوصيل لجميع المحافظات', 'Shipping in Egypt', '#page/shipping-policy'],
      ['care.returns', 'الاستبدال والاسترجاع (14 يوم)', 'Returns & Exchange', '#page/returns-policy'],
      ['care.about', 'عن البراند', 'About', '#page/about']
    ] as const).flatMap(([key, ar, en, href]) => [
      { key: `footer.${key}.ar`, label: `${ar} (عربي)`, fallback: ar },
      { key: `footer.${key}.en`, label: `${ar} (إنجليزي)`, fallback: en },
      { key: `footer.${key}.href`, label: `رابط: ${ar}`, fallback: href }
    ]),
    { key: 'footer.copyright.ar', label: 'حقوق النشر (عربي)', fallback: 'جميع الحقوق محفوظة. براند أزياء مصري عصري مسجل.' },
    { key: 'footer.copyright.en', label: 'حقوق النشر (إنجليزي)', fallback: 'All rights reserved. Contemporary Egyptian Fashion Brand.' },
    { key: 'footer.payment.cash.ar', label: 'طريقة الدفع نقداً (عربي)', fallback: 'الدفع عند الاستلام كاش' },
    { key: 'footer.payment.cards.ar', label: 'طريقة الدفع بطاقات (عربي)', fallback: 'فيزا وماستركارد' },
    { key: 'footer.payment.wallets.ar', label: 'المحافظ الإلكترونية (عربي)', fallback: 'فودافون كاش وإنستاباي InstaPay' },
    { key: 'footer.payment.shipping.ar', label: 'عبارة الشحن (عربي)', fallback: 'شحن لجميع محافظات مصر' },
    { key: 'footer.payment.cash.en', label: 'طريقة الدفع نقداً (إنجليزي)', fallback: 'Cash on delivery' },
    { key: 'footer.payment.cards.en', label: 'طريقة الدفع بطاقات (إنجليزي)', fallback: 'Visa & Mastercard' },
    { key: 'footer.payment.wallets.en', label: 'المحافظ الإلكترونية (إنجليزي)', fallback: 'Mobile wallets' },
    { key: 'footer.payment.shipping.en', label: 'عبارة الشحن (إنجليزي)', fallback: 'Shipping across Egypt' }
  ] }
];

const HOME_VISIBILITY_GROUPS = [
  { key: 'hero', label: 'البانر الرئيسي (Hero)', elements: [
    ['hero.background', 'صورة الخلفية'], ['hero.tagline', 'عنوان المجموعة أعلى البانر'], ['hero.title', 'العنوان الرئيسي'], ['hero.subtitle', 'الوصف'],
    ['hero.primaryCta', 'الزر الأول'], ['hero.secondaryCta', 'الزر الثاني'], ['hero.overlay', 'طبقة تحسين وضوح الصورة']
  ] },
  { key: 'pillars', label: 'مزايا البراند', elements: [
    ['pillars.item1', 'الميزة الأولى'], ['pillars.item2', 'الميزة الثانية'], ['pillars.item3', 'الميزة الثالثة'], ['pillars.item4', 'الميزة الرابعة']
  ] },
  { key: 'collections', label: 'المجموعات والتصنيفات', elements: [
    ['collections.eyebrow', 'العنوان الصغير'], ['collections.title', 'عنوان القسم'], ['collections.link', 'رابط عرض كل التصنيفات'], ['collections.grid', 'بطاقات التصنيفات'], ['collections.discover', 'عبارة اكتشف القطع داخل البطاقة']
  ] },
  { key: 'arrivals', label: 'وصل حديثاً', elements: [
    ['arrivals.eyebrow', 'العنوان الصغير'], ['arrivals.title', 'عنوان القسم'], ['arrivals.description', 'الوصف'], ['arrivals.products', 'شبكة المنتجات'], ['arrivals.button', 'زر عرض التشكيلة']
  ] },
  { key: 'story', label: 'قصة البراند', elements: [
    ['story.eyebrow', 'العنوان الصغير'], ['story.title', 'العنوان الرئيسي'], ['story.body1', 'الفقرة الأولى'], ['story.body2', 'الفقرة الثانية'], ['story.button', 'زر قراءة القصة'], ['story.image', 'الصورة']
  ] },
  { key: 'bestsellers', label: 'الأكثر مبيعاً', elements: [
    ['bestsellers.eyebrow', 'العنوان الصغير'], ['bestsellers.title', 'عنوان القسم'], ['bestsellers.link', 'رابط عرض الأكثر طلباً'], ['bestsellers.products', 'شبكة المنتجات']
  ] },
  { key: 'social', label: 'معرض الصور والتواصل', elements: [
    ['social.handle', 'اسم حساب التواصل'], ['social.title', 'عنوان المعرض'], ['social.image1', 'الصورة الأولى'], ['social.image2', 'الصورة الثانية'],
    ['social.image3', 'الصورة الثالثة'], ['social.image4', 'الصورة الرابعة'], ['social.image5', 'الصورة الخامسة']
  ] }
] as const;

export async function renderAdminView(currentSection: string = 'overview'): Promise<string> {
  const isAdmin = state.isAdmin();

  // If user is not logged in as Admin, or explicitly at #admin/login, show the Admin Login Screen
  if (!isAdmin || currentSection === 'login') {
    return renderAdminLoginView();
  }

  let orders: any[] = [];
  let products: any[] = [];
  let categories: any[] = [];
  let returns: any[] = [];
  let coupons: any[] = [];
  let reviews: any[] = [];
  let shippingZones: any[] = [];
  let inventoryMovements: any[] = [];
  let mediaItems: any[] = [];
  let pages: any[] = [];
  let settings: any = state.getSettings();

  if (adminCache) {
    orders = adminCache.orders;
    products = adminCache.products;
    categories = adminCache.categories;
    returns = adminCache.returns;
    coupons = adminCache.coupons;
    reviews = adminCache.reviews;
    shippingZones = adminCache.shippingZones;
    inventoryMovements = adminCache.inventoryMovements;
    mediaItems = adminCache.mediaItems;
    pages = adminCache.pages;
    settings = adminCache.settings;
  } else {
    try {
      // 1. Ultra-fast single call to backend unified data route
      const res = await fetch('/api/admin/data');
      const data = await res.json();
      if (data && data.success) {
        orders = data.orders || [];
        products = data.products || [];
        categories = data.categories || [];
        returns = data.returns || [];
        coupons = data.coupons || [];
        reviews = data.reviews || [];
        shippingZones = data.shippingZones || [];
        inventoryMovements = data.inventoryMovements || [];
        mediaItems = data.mediaItems || [];
        pages = data.pages || [];
        if (data.settings) settings = { ...settings, ...data.settings };
      }
    } catch (e) {
      console.warn('API admin data fetch error, attempting direct Firestore fallback', e);
      try {
        const [oSnap, pSnap, cSnap, rSnap, coupSnap, revSnap, zSnap, mSnap, medSnap, pagesSnap, setSnap] = await Promise.all([
          getDocs(collection(db, 'orders')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'products')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'categories')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'returns')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'coupons')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'reviews')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'shippingZones')).catch(() => ({ docs: [] })),
          getDocs(query(collection(db, 'inventoryMovements'), limit(20))).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'media')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'pages')).catch(() => ({ docs: [] })),
          getDoc(doc(db, 'settings', 'store')).catch(() => null)
        ]);

        orders = (oSnap as any).docs?.map((d: any) => ({ id: d.id, ...d.data() })) || [];
        products = (pSnap as any).docs?.map((d: any) => ({ id: d.id, ...d.data() })) || [];
        categories = (cSnap as any).docs?.map((d: any) => ({ id: d.id, ...d.data() })) || [];
        returns = (rSnap as any).docs?.map((d: any) => ({ id: d.id, ...d.data() })) || [];
        coupons = (coupSnap as any).docs?.map((d: any) => ({ id: d.id, ...d.data() })) || [];
        reviews = (revSnap as any).docs?.map((d: any) => ({ id: d.id, ...d.data() })) || [];
        shippingZones = (zSnap as any).docs?.map((d: any) => ({ id: d.id, ...d.data() })) || [];
        inventoryMovements = (mSnap as any).docs?.map((d: any) => ({ id: d.id, ...d.data() })) || [];
        mediaItems = (medSnap as any).docs?.map((d: any) => ({ id: d.id, ...d.data() })) || [];
        pages = (pagesSnap as any).docs?.map((d: any) => ({ id: d.id, ...d.data() })) || [];
        if (setSnap && (setSnap as any).exists && (setSnap as any).exists()) {
          settings = { ...settings, ...(setSnap as any).data() };
        }
      } catch (err) {
        console.error('Direct Firestore admin data fallback error', err);
      }
    }

    mediaItems.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    // Cache in memory for instantaneous zero-latency navigation between tabs
    adminCache = {
      timestamp: Date.now(),
      orders,
      products,
      categories,
      returns,
      coupons,
      reviews,
      shippingZones,
      inventoryMovements,
      mediaItems,
      pages,
      settings
    };
  }

  // Calculate Metrics
  const totalRevenue = orders.reduce((sum, o) => o.status !== 'cancelled' ? sum + (o.total || 0) : sum, 0);
  const activeOrdersCount = orders.filter(o => !['delivered', 'cancelled', 'returned'].includes(o.status)).length;
  const newOrdersCount = orders.filter(o => o.status === 'new').length;
  const lowStockProducts = products.filter(p => (p.totalStock !== undefined && p.totalStock <= 10));
  const avgOrderValue = orders.length > 0 ? (totalRevenue / orders.length).toFixed(1) : '0';

  const sectionTitles: Record<string, string> = {
    overview: 'نظرة عامة والمؤشرات',
    products: 'إدارة المنتجات والمتغيرات',
    categories: 'التصنيفات والمجموعات',
    inventory: 'المخزون وحركة القطع',
    orders: 'إدارة الطلبات والمبيعات',
    returns: 'المرتجعات والاستبدال',
    media: 'مكتبة الوسائط ورفع الصور المجانية',
    customers: 'قاعدة بيانات العملاء',
    coupons: 'الكوبونات والخصومات',
    cms: 'إدارة المحتوى والواجهة (CMS)',
    pages: 'صفحات الموقع الثابتة',
    shipping: 'إعدادات الشحن والمناطق',
    reviews: 'مراجعة وتقييمات العملاء',
    reports: 'التقارير المالية والأرباح'
  };

  return `
    <div class="admin-layout" dir="rtl" style="font-family: 'Cairo', sans-serif;">
      <!-- Mobile Sidebar Backdrop -->
      <div id="admin-sidebar-backdrop" class="admin-sidebar-backdrop"></div>
      
      <!-- Collapsible Admin Sidebar -->
      <aside class="admin-sidebar" id="admin-sidebar" style="font-family: 'Cairo', sans-serif;">
        <div class="admin-sidebar-header" style="direction: rtl;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="/assets/logo-icon-white.png" alt="EIGHTY-EIGHT" style="height: 28px; width: auto;" />
            <span style="font-weight: 800; letter-spacing: 0.05em; color: #ffffff; font-size: 16px;">EIGHTY-EIGHT</span>
          </div>
          <span style="font-size: 11px; background: #334155; color: #f8fafc; padding: 2px 8px; border-radius: 4px; font-weight: 700;">الإدارة</span>
        </div>

        <nav class="admin-nav" style="direction: rtl;">
          <a href="#admin/overview" class="admin-nav-item ${currentSection === 'overview' ? 'active' : ''}">
            <i class="fa-solid fa-table-cells-large" aria-hidden="true" style="font-size: 18px;"></i>
            <span>نظرة عامة والمؤشرات</span>
          </a>

          <a href="#admin/products" class="admin-nav-item ${currentSection === 'products' ? 'active' : ''}">
            <i class="fa-solid fa-bag-shopping" aria-hidden="true" style="font-size: 18px;"></i>
            <span>إدارة المنتجات والمتغيرات</span>
            <span style="margin-right: auto; font-size: 11px; background: #1e293b; padding: 2px 6px; border-radius: 4px;">${products.length}</span>
          </a>

          <a href="#admin/media" class="admin-nav-item ${currentSection === 'media' ? 'active' : ''}">
            <i class="fa-solid fa-image" aria-hidden="true" style="font-size: 18px;"></i>
            <span>مكتبة الوسائط ورفع الصور</span>
            <span style="margin-right: auto; font-size: 10px; background: #15803d; color: #fff; padding: 2px 6px; border-radius: 4px;">مجاني</span>
          </a>

          <a href="#admin/categories" class="admin-nav-item ${currentSection === 'categories' ? 'active' : ''}">
            <i class="fa-solid fa-folder" aria-hidden="true" style="font-size: 18px;"></i>
            <span>التصنيفات والمجموعات</span>
            <span style="margin-right: auto; font-size: 11px; background: #1e293b; padding: 2px 6px; border-radius: 4px;">${categories.length}</span>
          </a>

          <a href="#admin/inventory" class="admin-nav-item ${currentSection === 'inventory' ? 'active' : ''}">
            <i class="fa-solid fa-boxes-stacked" aria-hidden="true" style="font-size: 18px;"></i>
            <span>المخزون وحركة القطع</span>
            ${lowStockProducts.length > 0 ? `<span style="margin-right: auto; font-size: 11px; background: #b91c1c; color: #fff; padding: 2px 6px; border-radius: 4px;">${lowStockProducts.length} منخفض</span>` : ''}
          </a>

          <a href="#admin/orders" class="admin-nav-item ${currentSection === 'orders' ? 'active' : ''}">
            <i class="fa-solid fa-cart-shopping" aria-hidden="true" style="font-size: 18px;"></i>
            <span>إدارة الطلبات</span>
            ${newOrdersCount > 0 ? `<span style="margin-right: auto; font-size: 11px; background: #15803d; color: #fff; padding: 2px 6px; border-radius: 4px;">${newOrdersCount} جديد</span>` : ''}
          </a>

          <a href="#admin/returns" class="admin-nav-item ${currentSection === 'returns' ? 'active' : ''}">
            <i class="fa-solid fa-arrows-rotate" aria-hidden="true" style="font-size: 18px;"></i>
            <span>المرتجعات والاستبدال</span>
            <span style="margin-right: auto; font-size: 11px; background: #1e293b; padding: 2px 6px; border-radius: 4px;">${returns.length}</span>
          </a>

          <a href="#admin/customers" class="admin-nav-item ${currentSection === 'customers' ? 'active' : ''}">
            <i class="fa-solid fa-users" aria-hidden="true" style="font-size: 18px;"></i>
            <span>قاعدة العملاء</span>
          </a>

          <a href="#admin/coupons" class="admin-nav-item ${currentSection === 'coupons' ? 'active' : ''}">
            <i class="fa-solid fa-tags" aria-hidden="true" style="font-size: 18px;"></i>
            <span>الكوبونات والعروض</span>
            <span style="margin-right: auto; font-size: 11px; background: #1e293b; padding: 2px 6px; border-radius: 4px;">${coupons.length}</span>
          </a>

          <a href="#admin/cms" class="admin-nav-item ${currentSection === 'cms' ? 'active' : ''}">
            <i class="fa-solid fa-layer-group" aria-hidden="true" style="font-size: 18px;"></i>
            <span>إدارة المحتوى والواجهة (CMS)</span>
          </a>

          <a href="#admin/shipping" class="admin-nav-item ${currentSection === 'shipping' ? 'active' : ''}">
            <i class="fa-solid fa-truck" aria-hidden="true" style="font-size: 18px;"></i>
            <span>إعدادات الشحن والمناطق</span>
          </a>

          <a href="#admin/pages" class="admin-nav-item ${currentSection === 'pages' ? 'active' : ''}">
            <i class="fa-regular fa-file-lines" aria-hidden="true" style="font-size:18px;"></i>
            <span>صفحات الموقع الثابتة</span>
            <span style="margin-right:auto;font-size:11px;background:#1e293b;padding:2px 6px;border-radius:4px;">${pages.length}</span>
          </a>

          <a href="#admin/reviews" class="admin-nav-item ${currentSection === 'reviews' ? 'active' : ''}">
            <i class="fa-solid fa-comment" aria-hidden="true" style="font-size: 18px;"></i>
            <span>مراجعة التقييمات</span>
          </a>

          <a href="#admin/reports" class="admin-nav-item ${currentSection === 'reports' ? 'active' : ''}">
            <i class="fa-solid fa-chart-column" aria-hidden="true" style="font-size: 18px;"></i>
            <span>التقارير المالية والأرباح</span>
          </a>
        </nav>

      </aside>

      <!-- Main Admin Content Area -->
      <div class="admin-main">
        
        <!-- Header -->
        <header class="admin-header">
          <div class="admin-header-title">
            <button id="admin-sidebar-toggle" class="icon-btn" style="border: 1px solid #e2e8f0;">
              <i class="fa-solid fa-bars" aria-hidden="true" style="font-size: 20px;"></i>
            </button>
            <h3 style="font-size: 20px; font-weight: 700; color: #0f172a;">
              ${sectionTitles[currentSection] || 'لوحة التحكم الإدارية'}
            </h3>
          </div>

          <div class="admin-header-actions">
            <!-- Instant Refresh Data Button -->
            <button id="admin-refresh-data-btn" class="btn btn-sm btn-secondary" style="font-size: 12px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; font-weight: 600;">
              <i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i><span>تحديث البيانات</span>
            </button>

            <!-- Admin Sign Out Button -->
            <button id="admin-logout-btn" class="btn btn-sm btn-ghost" style="color: #b91c1c; border: 1px solid #fecaca; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 9999px;" title="تسجيل الخروج من لوحة الإدارة">
              <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i><span>تسجيل الخروج</span>
            </button>
          </div>
        </header>

        <!-- Dynamic Admin Content Body -->
        <main class="admin-content">
          ${renderAdminSection(currentSection, {
            orders,
            products,
            categories,
            returns,
            coupons,
            reviews,
            shippingZones,
            inventoryMovements,
            mediaItems,
            pages,
            settings,
            totalRevenue,
            activeOrdersCount,
            newOrdersCount,
            lowStockProducts,
            avgOrderValue
          })}
        </main>

      </div>
    </div>
  `;
}

// Arabic Section Renderer
function renderAdminSection(section: string, data: any): string {
  const { orders, products, categories, returns, coupons, reviews = [], shippingZones, inventoryMovements, mediaItems, pages = [], totalRevenue, activeOrdersCount, newOrdersCount, lowStockProducts, avgOrderValue, settings } = data;

  switch (section) {
    case 'overview':
      return `
        <!-- KPI Cards Grid -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-lg); margin-bottom: var(--space-2xl);" class="kpi-grid">
          <div class="admin-card" style="padding: var(--space-lg); margin-bottom: 0;">
            <span style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">إجمالي المبيعات والإيرادات</span>
            <div style="font-size: 28px; font-weight: 700; color: #0f172a; margin-top: 4px; font-family: 'Cairo', sans-serif;">${state.formatPrice(totalRevenue)}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">إجمالي المبيعات غير الملغاة</div>
          </div>

          <div class="admin-card" style="padding: var(--space-lg); margin-bottom: 0;">
            <span style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">إجمالي الطلبات المسجلة</span>
            <div style="font-size: 28px; font-weight: 700; color: #0f172a; margin-top: 4px; font-family: 'Cairo', sans-serif;">${orders.length}</div>
            <div style="font-size: 12px; color: #15803d; margin-top: 4px;">${newOrdersCount} طلب بانتظار المراجعة والاعتماد</div>
          </div>

          <div class="admin-card" style="padding: var(--space-lg); margin-bottom: 0;">
            <span style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">متوسط قيمة الطلب (AOV)</span>
            <div style="font-size: 28px; font-weight: 700; color: #0f172a; margin-top: 4px; font-family: 'Cairo', sans-serif;">${state.formatPrice(avgOrderValue)}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">معدل سلة الشراء لمنتجات الكوتور</div>
          </div>

          <div class="admin-card" style="padding: var(--space-lg); margin-bottom: 0;">
            <span style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">تنبيهات المخزون الحرج</span>
            <div style="font-size: 28px; font-weight: 700; color: ${lowStockProducts.length > 0 ? '#b91c1c' : '#0f172a'}; margin-top: 4px; font-family: 'Cairo', sans-serif;">${lowStockProducts.length}</div>
            <div style="font-size: 12px; color: ${lowStockProducts.length > 0 ? '#b91c1c' : '#16a34a'}; margin-top: 4px;">${lowStockProducts.length > 0 ? 'يتطلب إعادة التوريد من ورشة الخياطة' : 'المخزون بوضع ممتاز'}</div>
          </div>
        </div>

        <!-- Recent Orders Table -->
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <h3 style="font-size: 17px; font-weight: 700;">أحدث طلبات العملاء المباشرة</h3>
              <p style="font-size: 12px; color: #64748b;">سجلات الشراء الحية المسجلة عبر واجهة المتجر</p>
            </div>
            <a href="#admin/orders" class="btn btn-secondary btn-sm" style="font-size: 12px;">عرض كافة الطلبات (${orders.length}) ←</a>
          </div>

          <div class="admin-table-scroll"><table class="admin-table">
            <thead>
              <tr>
                <th>رقم الطلب</th>
                <th>اسم العميل</th>
                <th>رقم الجوال</th>
                <th>عدد القطع</th>
                <th>الإجمالي</th>
                <th>طريقة الدفع</th>
                <th>حالة الطلب</th>
                <th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              ${orders.length === 0 ? `
                <tr><td colspan="8" style="text-align: center; padding: 24px;">لا توجد طلبات مسجلة حتى الآن.</td></tr>
              ` : orders.slice(0, 5).map((o: any) => `
                <tr>
                  <td><strong>${o.orderNumber}</strong></td>
                  <td>${o.customerName}</td>
                  <td>${o.customerPhone}</td>
                  <td>${(o.items || []).length} قطع</td>
                  <td><strong>${state.formatPrice(o.total)}</strong></td>
                  <td>${o.paymentMethod === 'cod' ? 'الدفع عند الاستلام' : (o.paymentMethod?.toUpperCase() || 'دفع إلكتروني')}</td>
                  <td><span class="status-pill ${o.status}">${getStatusArabic(o.status)}</span></td>
                  <td>
                    <button class="open-order-details-btn btn btn-ghost btn-sm" data-id="${o.id}" style="font-size: 12px; text-decoration: underline; color: #15803d;">
                      فحص وإدارة
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        </div>
      `;

    case 'products':
      return `
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <h3 style="font-size: 17px; font-weight: 700;">كتالوج الأزياء والقطع الفاخرة (${products.length})</h3>
              <p style="font-size: 12px; color: #64748b;">إدارة التصاميم، الأسعار، المقاسات، الألوان، صور المنتجات، والمخزون</p>
            </div>
            <div style="display: flex; gap: 8px;">
              <button id="admin-add-product-btn" class="btn btn-primary btn-sm" style="font-size: 12px;">
                + إضافة قطعة أزياء جديدة
              </button>
            </div>
          </div>

          <div class="admin-table-scroll"><table class="admin-table">
            <thead>
              <tr>
                <th>القطعة والصورة</th>
                <th>كود SKU</th>
                <th>التصنيف</th>
                <th>السعر الأساسي</th>
                <th>المتغيرات والمخزون</th>
                <th>حالة النشر</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${products.map((p: any) => `
                <tr>
                  <td style="display: flex; align-items: center; gap: 10px;">
                    <img src="${(p.images && p.images[0]) || ''}" alt="" style="width: 44px; height: 56px; object-fit: cover; border-radius: 4px; border: 1px solid #e2e8f0;" />
                    <div>
                      <strong style="font-size: 14px;">${p.nameAr || p.name}</strong>
                      <div style="font-size: 12px; color: #64748b;">${p.name || ''}</div>
                    </div>
                  </td>
                  <td><code>${p.sku || '—'}</code></td>
                  <td>${p.categoryName || 'كوتور'}</td>
                  <td><strong>${state.formatPrice(p.salePrice || p.price)}</strong></td>
                  <td>
                    <span style="font-weight: 700; color: ${p.totalStock <= 5 ? '#b91c1c' : '#0f172a'};">${p.totalStock ?? 0} قطعة بالمخزون</span>
                    <div style="font-size: 11px; color: #64748b;">${(p.variants || []).length} مقاس ولون</div>
                  </td>
                  <td>
                    <span class="status-pill ${p.isPublished ? 'delivered' : 'cancelled'}">
                      ${p.isPublished ? 'منشور بالمتجر' : 'مسودة مخفية'}
                    </span>
                  </td>
                  <td>
                    <div style="display: flex; gap: 6px;">
                      <button class="admin-edit-prod-btn btn btn-ghost btn-sm" data-id="${p.id}" style="color: #15803d; font-size: 12px; font-weight: 600;">تعديل</button>
                      <button class="admin-del-prod-btn btn btn-ghost btn-sm" data-id="${p.id}" style="color: #b91c1c; font-size: 12px; font-weight: 600;">حذف</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        </div>
      `;

    // FREE MEDIA LIBRARY SECTION
    case 'media':
      return `
        <!-- Media Library Header & Upload Box -->
        <div class="admin-card" style="padding: var(--space-xl);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-lg); flex-wrap: wrap; gap: var(--space-md);">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h3 style="font-size: 18px; font-weight: 700; margin: 0;">مكتبة الوسائط ورفع الصور المجانية</h3>
                <span style="background: #15803d; color: #ffffff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">100% مجاناً بدون وسيلة دفع</span>
              </div>
              <p style="font-size: 13px; color: #64748b; margin-top: 4px;">
                ارفع صور منتجاتك والبانرات مباشرة من جهازك (كمبيوتر أو هاتف) بدون الحاجة لحساب فايربيز مدفوع أو بطاقة بنكية.
              </p>
            </div>

            <!-- Upload Button -->
            <label class="btn btn-gold btn-sm" style="cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; padding: 10px 18px;">
              <i class="fa-solid fa-upload" aria-hidden="true" style="font-size: 18px;"></i>
              <span>+ رفع صور من جهازك</span>
              <input type="file" id="media-bulk-upload-input" accept="image/*" multiple style="display: none;" />
            </label>
          </div>

          <!-- Drag and drop zone -->
          <div id="media-dropzone" style="border: 2px dashed #cbd5e1; border-radius: 8px; padding: 32px 20px; text-align: center; background: #f8fafc; transition: all 0.2s; cursor: pointer;">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(197, 160, 89, 0.15); color: var(--color-brand-gold); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
              <i class="fa-solid fa-image" aria-hidden="true" style="font-size: 24px;"></i>
            </div>
            <h4 style="font-size: 15px; font-weight: 700; margin-bottom: 4px;">اسحب الصور وأفلتها هنا أو اضغط للاختيار من جهازك</h4>
            <p style="font-size: 12px; color: #64748b; margin: 0;">
              يدعم صيغ JPG، PNG، WEBP، GIF (حجم غير محدود ومجاني بالكامل)
            </p>
          </div>
        </div>

        <!-- Uploaded Images Grid -->
        <div class="admin-card" style="padding: var(--space-xl);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg);">
            <h3 style="font-size: 16px; font-weight: 700;">الصور المرفوعة في النظام (${mediaItems.length})</h3>
            <span style="font-size: 12px; color: #64748b;">تُخزن الصور تلقائياً في السيرفر وتتاح فوراً للاستخدام بالمنتجات</span>
          </div>

          ${mediaItems.length === 0 ? `
            <div style="text-align: center; padding: 48px 20px; color: #64748b;">
              <i class="fa-solid fa-image" aria-hidden="true" style="font-size: 48px;"></i>
              <p style="font-size: 14px; font-weight: 600;">لم يتم رفع أي صور بعد.</p>
              <p style="font-size: 12px;">اضغط على زر "رفع صور من جهازك" أعلاه لبدء رفع صور تصاميمك وملابسك مجاناً.</p>
            </div>
          ` : `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--space-lg);" id="media-grid">
              ${mediaItems.map((m: any) => `
                <div class="media-card" style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; background: #ffffff; display: flex; flex-direction: column;">
                  <div style="position: relative; padding-top: 120%; background: #f1f5f9; overflow: hidden;">
                    <img src="${m.url}" alt="${m.originalName || ''}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s;" />
                  </div>
                  <div style="padding: 12px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                      <div style="font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${m.originalName || m.filename}">
                        ${m.originalName || m.filename}
                      </div>
                      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                        ${(m.size ? (m.size / 1024).toFixed(1) + ' KB' : 'صورة')} • ${new Date(m.createdAt || Date.now()).toLocaleDateString('ar-EG')}
                      </div>
                    </div>
                    
                    <div style="display: flex; gap: 6px; margin-top: 10px;">
                      <button class="btn btn-secondary btn-sm admin-copy-url-btn" data-url="${m.url}" style="flex: 1; font-size: 11px; padding: 4px 8px;" title="نسخ الرابط المباشر">
                        <i class="fa-solid fa-clipboard" aria-hidden="true"></i> نسخ الرابط
                      </button>
                      <button class="btn btn-ghost btn-sm admin-del-media-btn" data-id="${m.id}" style="color: #b91c1c; font-size: 11px; padding: 4px 8px;" title="حذف الصورة">
                        <i class="fa-solid fa-trash" aria-hidden="true"></i>
                      </button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;

    case 'orders':
      return `
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <h3 style="font-size: 17px; font-weight: 700;">دورة حياة الطلبات وإدارة الشحن (${orders.length})</h3>
              <p style="font-size: 12px; color: #64748b;">تأكيد المدفوعات، تحديث حالات الشحن، إصدار بوليصات التتبع، وإدارة الإلغاء</p>
            </div>
          </div>

          <div class="admin-table-scroll"><table class="admin-table">
            <thead>
              <tr>
                <th>رقم الطلب</th>
                <th>تاريخ الطلب</th>
                <th>بيانات العميل</th>
                <th>منطقة التوصيل</th>
                <th>الإجمالي</th>
                <th>الحالة الحالية</th>
                <th>رقم التتبع</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map((o: any) => `
                <tr>
                  <td><strong>${o.orderNumber}</strong></td>
                  <td>${new Date(o.createdAt).toLocaleDateString('ar-EG')}</td>
                  <td>
                    <div style="font-weight: 700;">${o.customerName}</div>
                    <div style="font-size: 11px; color: #64748b;">${o.customerPhone}</div>
                  </td>
                  <td>${o.shippingZoneName || o.shippingAddress?.city || 'شحن قياسي'}</td>
                  <td><strong>${state.formatPrice(o.total)}</strong></td>
                  <td><span class="status-pill ${o.status}">${getStatusArabic(o.status)}</span></td>
                  <td><code>${o.trackingNumber || 'لم يُحدد'}</code></td>
                  <td>
                    <button type="button" class="open-order-details-btn btn btn-primary btn-sm" data-id="${o.id}" style="font-size: 12px; padding: 4px 12px;">
                      إدارة الطلب
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        </div>
      `;

    case 'inventory':
      return `
        <div class="inventory-layout" style="display: grid; grid-template-columns: 2fr 1fr; gap: var(--space-xl);">
          <!-- Live Inventory Table -->
          <div class="admin-card">
            <div class="admin-card-header">
              <h3 style="font-size: 17px; font-weight: 700;">مصفوفة مخزون المقاسات والألوان الحية</h3>
              <button id="admin-adjust-stock-btn" class="btn btn-primary btn-sm" style="font-size: 12px;">+ تعديل المخزون يدوياً</button>
            </div>
            <div class="admin-table-scroll"><table class="admin-table">
              <thead>
                <tr>
                  <th>القطعة</th>
                  <th>كود SKU</th>
                  <th>اللون / المقاس</th>
                  <th>الكمية المتاحة</th>
                </tr>
              </thead>
              <tbody>
                ${products.flatMap((p: any) => (p.variants || []).map((v: any) => `
                  <tr>
                    <td><strong>${p.nameAr || p.name}</strong></td>
                    <td><code>${v.sku}</code></td>
                    <td>${v.color} • ${v.size}</td>
                    <td>
                      <span style="font-weight: 700; color: ${v.stock <= 3 ? '#b91c1c' : '#15803d'};">
                        ${v.stock} قطعة
                      </span>
                    </td>
                  </tr>
                `)).join('')}
              </tbody>
            </table></div>
          </div>

          <!-- Movement History Audit Trail -->
          <div class="admin-card">
            <div class="admin-card-header">
              <h3 style="font-size: 17px; font-weight: 700;">سجل حركة وسحب المخزون</h3>
            </div>
            <div style="padding: var(--space-md); display: flex; flex-direction: column; gap: 10px; max-height: 500px; overflow-y: auto;">
              ${inventoryMovements.length === 0 ? `
                <p style="font-size: 12px; color: #64748b;">لا توجد حركات مسجلة مؤخراً.</p>
              ` : inventoryMovements.map((m: any) => `
                <div style="padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 12px;">
                  <div style="display: flex; justify-content: space-between; font-weight: 700;">
                    <span>${m.type === 'checkout_deduction' ? 'خصم مبيعات' : 'تعديل مخزني'}</span>
                    <span style="color: ${m.quantityDelta > 0 ? '#16a34a' : '#b91c1c'};">${m.quantityDelta > 0 ? '+' : ''}${m.quantityDelta}</span>
                  </div>
                  <div style="color: #64748b; margin-top: 2px;">SKU: ${m.sku}</div>
                  <div style="color: #475569; margin-top: 2px;">${m.reason || ''}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;

    case 'categories':
      return `
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <h3 style="font-size: 17px; font-weight: 700;">إدارة الأقسام وتصنيفات الأزياء (${categories.length})</h3>
              <p style="font-size: 12px; color: #64748b;">تنظيم أقسام المعاطف، الفساتين، ملابس السهرة، والأزياء الراقية</p>
            </div>
            <button id="admin-add-category-btn" class="btn btn-primary btn-sm" style="font-size: 12px;">+ إضافة قسم جديد</button>
          </div>
          <div class="admin-table-scroll"><table class="admin-table">
            <thead>
              <tr>
                <th>القسم والصورة</th>
                <th>الرابط (Slug)</th>
                <th>ترتيب العرض</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${categories.map((c: any) => `
                <tr>
                  <td style="display: flex; align-items: center; gap: 10px;">
                    <img src="${c.imageUrl}" alt="" style="width: 44px; height: 44px; object-fit: cover; border-radius: 4px; border: 1px solid #e2e8f0;" />
                    <div>
                      <strong style="font-size: 14px;">${c.nameAr || c.name}</strong>
                      <div style="font-size: 11px; color: #64748b;">${c.name || ''}</div>
                    </div>
                  </td>
                  <td><code>${c.slug}</code></td>
                  <td>${c.sortOrder || 1}</td>
                  <td><span class="status-pill ${c.isActive ? 'delivered' : 'cancelled'}">${c.isActive ? 'مفعل بالمتجر' : 'مخفي'}</span></td>
                  <td>
                    <button type="button" class="admin-edit-cat-btn btn btn-ghost btn-sm" data-id="${c.id}" style="color: #15803d; font-size: 12px; font-weight: 600;">تعديل</button>
                    <button type="button" class="admin-del-cat-btn btn btn-ghost btn-sm" data-id="${c.id}" style="color: #b91c1c; font-size: 12px; font-weight: 600;">حذف</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        </div>
      `;

    case 'returns':
      return `
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <h3 style="font-size: 17px; font-weight: 700;">طلبات الإرجاع والاستبدال من العملاء (${returns.length})</h3>
              <p style="font-size: 12px; color: #64748b;">فحص حالة القطعة المسترجعة، إعادة المخزون، واعتماد الاستبدال أو رد الأموال</p>
            </div>
          </div>
          <div class="admin-table-scroll"><table class="admin-table">
            <thead>
              <tr>
                <th>رقم الطلب</th>
                <th>العميل</th>
                <th>نوع الطلب</th>
                <th>السبب</th>
                <th>ملاحظات العميل</th>
                <th>حالة المعالجة</th>
                <th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              ${returns.length === 0 ? `
                <tr><td colspan="7" style="text-align: center; padding: 24px;">لا توجد طلبات إرجاع واردة.</td></tr>
              ` : returns.map((r: any) => `
                <tr>
                  <td><strong>${r.orderNumber}</strong></td>
                  <td>${r.customerEmail}</td>
                  <td><code>${r.type === 'exchange' ? 'استبدال مقاس' : 'استرجاع'}</code></td>
                  <td>${r.reason}</td>
                  <td style="font-size: 12px; color: #64748b;">${r.detailedReason || '—'}</td>
                  <td><span class="status-pill ${r.status}">${r.status}</span></td>
                  <td>
                    <button class="admin-process-return-btn btn btn-secondary btn-sm" data-id="${r.id}" style="font-size: 12px;">
                      معالجة واتخاذ قرار
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        </div>
      `;

    case 'coupons':
      return `
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <h3 style="font-size: 17px; font-weight: 700;">كوبونات الخصم والعروض الترويجية (${coupons.length})</h3>
              <p style="font-size: 12px; color: #64748b;">إنشاء رموز الخصم بنسبة مئوية أو مبلغ ثابت وتحديد الحد الأدنى للشراء</p>
            </div>
            <button id="admin-add-coupon-btn" class="btn btn-primary btn-sm" style="font-size: 12px;">+ إنشاء كود خصم جديد</button>
          </div>
          <div class="admin-table-scroll"><table class="admin-table">
            <thead>
              <tr>
                <th>رمز الكوبون</th>
                <th>قيمة الخصم</th>
                <th>الحد الأدنى للطلب</th>
                <th>عدد مرات الاستخدام</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${coupons.map((cp: any) => `
                <tr>
                  <td><strong style="letter-spacing: 0.1em; color: var(--color-brand); font-size: 14px;">${cp.code}</strong></td>
                  <td><strong>${cp.discountType === 'percentage' ? `خصم ${cp.discountValue}%` : `خصم ${state.formatPrice(cp.discountValue)} ثابت`}</strong></td>
                  <td>${state.formatPrice(cp.minOrderValue || 0)}</td>
                  <td>${cp.usageCount || 0} / ${cp.usageLimit || 'غير محدود'}</td>
                  <td><span class="status-pill ${cp.isActive ? 'delivered' : 'cancelled'}">${cp.isActive ? 'مفعل' : 'معطل'}</span></td>
                  <td>
                    <button class="admin-toggle-coupon-btn btn btn-ghost btn-sm" data-id="${cp.id}" data-active="${cp.isActive}" style="font-size: 12px; font-weight: 600;">
                      ${cp.isActive ? 'تعطيل الكوبون' : 'تفعيل الكوبون'}
                    </button>
                    <button type="button" class="admin-edit-coupon-btn btn btn-secondary btn-sm" data-id="${cp.id}" style="font-size:12px;">تعديل البيانات</button>
                    <button type="button" class="admin-del-coupon-btn btn btn-ghost btn-sm" data-id="${cp.id}" style="color:#b91c1c;font-size:12px;">حذف</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        </div>
      `;

    case 'pages':
      return `
        <div class="admin-card">
          <div class="admin-card-header">
            <div><h3 style="font-size:17px;font-weight:700;">صفحات الموقع الثابتة (${pages.length})</h3><p style="font-size:12px;color:#64748b;">إدارة صفحات عن المتجر والشحن والاستبدال ودليل المقاسات وأي صفحة محتوى إضافية.</p></div>
            <button id="admin-add-page-btn" class="btn btn-primary btn-sm">+ إضافة صفحة</button>
          </div>
          <div class="admin-table-scroll"><table class="admin-table">
            <thead><tr><th>عنوان الصفحة</th><th>الرابط</th><th>الحالة</th><th>الإجراءات</th></tr></thead>
            <tbody>
              ${pages.length ? pages.map((page: any) => `
                <tr>
                  <td><strong>${page.titleAr || page.title || page.slug}</strong><div style="font-size:11px;color:#64748b;">${page.title || ''}</div></td>
                  <td><code>/page/${page.slug}</code></td>
                  <td><span class="status-pill ${page.isPublished === false ? 'cancelled' : 'delivered'}">${page.isPublished === false ? 'مسودة' : 'منشورة'}</span></td>
                  <td><button class="admin-edit-page-btn btn btn-secondary btn-sm" data-id="${page.id}">تعديل</button> <button class="admin-delete-page-btn btn btn-ghost btn-sm" data-id="${page.id}" style="color:#b91c1c;">حذف</button></td>
                </tr>
              `).join('') : '<tr><td colspan="4" style="text-align:center;padding:24px;">لا توجد صفحات محفوظة.</td></tr>'}
            </tbody>
          </table></div>
        </div>
      `;

    case 'cms':
      return `
        <div class="admin-card" style="padding: var(--space-xl);">
          <h3 style="font-size: 18px; font-weight: 700; margin-bottom: var(--space-lg); border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">
            تخصيص هوية المتجر والواجهة الرئيسية (CMS)
          </h3>

          <form id="admin-settings-form" style="display: flex; flex-direction: column; gap: var(--space-lg);">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);">
              <div class="form-group">
                <label class="form-label">اسم البراند (بالعربية) *</label>
                <input type="text" id="set-brand-ar" class="form-input" value="${settings.brandNameAr || ''}" />
              </div>
              <div class="form-group">
                <label class="form-label">اسم البراند (بالإنجليزية) *</label>
                <input type="text" id="set-brand-en" class="form-input" value="${settings.brandName || ''}" />
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
              <div class="form-group">
                <label class="form-label">شعار الهيدر</label>
                <input type="url" id="set-header-logo" class="form-input" value="${settings.headerLogoUrl || '/assets/logo-icon.png'}" />
                <label class="btn btn-secondary btn-sm" style="cursor:pointer;display:inline-flex;margin-top:8px;">رفع شعار من الجهاز<input type="file" accept="image/*" data-image-upload-for="set-header-logo" data-image-preview="set-header-logo-preview" style="display:none;" /></label>
                <img id="set-header-logo-preview" src="${settings.headerLogoUrl || '/assets/logo-icon.png'}" alt="معاينة شعار الهيدر" style="display:block;height:42px;max-width:160px;object-fit:contain;margin-top:8px;" />
              </div>
              <div class="form-group">
                <label class="form-label">شعار الفوتر</label>
                <input type="url" id="set-footer-logo" class="form-input" value="${settings.footerLogoUrl || '/assets/logo-icon-white.png'}" />
                <label class="btn btn-secondary btn-sm" style="cursor:pointer;display:inline-flex;margin-top:8px;">رفع شعار من الجهاز<input type="file" accept="image/*" data-image-upload-for="set-footer-logo" data-image-preview="set-footer-logo-preview" style="display:none;" /></label>
                <img id="set-footer-logo-preview" src="${settings.footerLogoUrl || '/assets/logo-icon-white.png'}" alt="معاينة شعار الفوتر" style="display:block;height:42px;max-width:160px;object-fit:contain;margin-top:8px;" />
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
              <div class="form-group"><label class="form-label">وصف المتجر (عربي)</label><input id="set-tagline-ar" class="form-input" value="${settings.taglineAr || ''}" /></div>
              <div class="form-group"><label class="form-label">وصف المتجر (إنجليزي)</label><input id="set-tagline-en" class="form-input" value="${settings.tagline || ''}" /></div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);">
              <div class="form-group">
                <label class="form-label">عنوان البانر الرئيسي Hero (بالعربية)</label>
                <input type="text" id="set-hero-title-ar" class="form-input" value="${settings.heroTitleAr || ''}" />
              </div>
              <div class="form-group">
                <label class="form-label">عنوان البانر الرئيسي Hero (بالإنجليزية)</label>
                <input type="text" id="set-hero-title-en" class="form-input" value="${settings.heroTitle || ''}" />
              </div>
            </div>

            <!-- Free upload for hero image -->
            <div class="form-group">
              <label class="form-label">صورة الهيرو للديسكتوب (رفع من الجهاز أو رابط)</label>
              <div style="display: flex; gap: 8px;">
                <input type="url" id="set-hero-img" class="form-input" style="flex: 1;" value="${settings.heroImageUrl || ''}" />
                <label class="btn btn-secondary btn-sm" style="cursor: pointer; display: flex; align-items: center; gap: 4px; white-space: nowrap;">
                  <span>📁 رفع من جهازك</span>
                  <input type="file" id="set-hero-file-upload" accept="image/*" style="display: none;" />
                </label>
              </div>
              <div id="set-hero-preview-box" style="margin-top: 8px;">
                <img id="set-hero-preview-img" src="${settings.heroImageUrl || ''}" style="height: 100px; border-radius: 4px; border: 1px solid #cbd5e1; object-fit: cover;" />
              </div>
              <small style="color:var(--color-text-muted);">لأفضل عرض استخدم صورة عريضة للديسكتوب (16:9 تقريباً) وصورة رأسية للهاتف (4:5 أو 9:16). تُقص الصورة تلقائياً لتناسب الشاشة.</small>
            </div>

            <div class="form-group">
              <label class="form-label">صورة الهيرو للموبايل (عمودية ومناسبة لشاشة الهاتف)</label>
              <div style="display:flex;gap:8px;">
                <input type="url" id="set-hero-mobile-img" class="form-input" style="flex:1;" value="${settings.heroImageMobileUrl || ''}" />
                <label class="btn btn-secondary btn-sm" style="cursor:pointer;white-space:nowrap;">رفع صورة هاتف<input type="file" id="set-hero-mobile-file-upload" accept="image/*" style="display:none;" /></label>
              </div>
              <img id="set-hero-mobile-preview-img" src="${settings.heroImageMobileUrl || ''}" alt="معاينة صورة الهاتف" style="height:120px;margin-top:8px;border-radius:4px;object-fit:cover;" />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);">
              <div class="form-group">
                <label class="form-label">شريط الإعلانات العلوي Announcement Bar (بالعربية)</label>
                <input type="text" id="set-ann-ar" class="form-input" value="${settings.announcementBarTextAr || ''}" />
              </div>
              <div class="form-group">
                <label class="form-label">شريط الإعلانات العلوي Announcement Bar (بالإنجليزية)</label>
                <input type="text" id="set-ann-en" class="form-input" value="${settings.announcementBarText || ''}" />
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
              <div class="form-group"><label class="form-label">وصف البانر (عربي)</label><textarea id="set-hero-subtitle-ar" class="form-textarea" rows="3">${settings.heroSubtitleAr || ''}</textarea></div>
              <div class="form-group"><label class="form-label">وصف البانر (إنجليزي)</label><textarea id="set-hero-subtitle-en" class="form-textarea" rows="3">${settings.heroSubtitle || ''}</textarea></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
              <div class="form-group"><label class="form-label">زر البانر (عربي)</label><input type="text" id="set-hero-cta-ar" class="form-input" value="${settings.heroCtaTextAr || ''}" /></div>
              <div class="form-group"><label class="form-label">زر البانر (إنجليزي)</label><input type="text" id="set-hero-cta-en" class="form-input" value="${settings.heroCtaText || ''}" /></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
              <div class="form-group"><label class="form-label"><input type="checkbox" id="set-ann-active" ${settings.announcementBarActive !== false ? 'checked' : ''} /> إظهار شريط الإعلانات العلوي</label></div>
              <div class="form-group"><label class="form-label">لون شريط الإعلانات</label><input type="color" id="set-ann-color" class="form-input" value="${settings.announcementBarBgColor || '#15803d'}" /></div>
            </div>
            <details class="admin-card" open style="padding:var(--space-md);">
              <summary style="cursor:pointer;font-weight:700;font-size:16px;">إظهار وإخفاء أقسام الصفحة الرئيسية وعناصرها</summary>
              <p style="font-size:12px;color:var(--color-text-muted);margin:8px 0 14px;">فعّل أو أخفِ أي قسم بالكامل، أو تحكم في ظهور كل عنصر بداخله. الأقسام الجديدة تعمل بالإظهار افتراضياً.</p>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;">
                ${HOME_VISIBILITY_GROUPS.map(group => `
                  <fieldset style="border:1px solid var(--color-border);border-radius:8px;padding:12px;min-width:0;">
                    <legend style="padding:0 6px;font-weight:700;">${group.label}</legend>
                    <label style="display:flex;gap:8px;align-items:center;font-weight:700;margin-bottom:10px;">
                      <input type="checkbox" data-home-visibility="section.${group.key}" ${settings.homeVisibility?.[`section.${group.key}`] !== false ? 'checked' : ''} /> إظهار القسم بالكامل
                    </label>
                    <div style="display:grid;gap:7px;">
                      ${group.elements.map(([key, label]) => `
                        <label style="display:flex;gap:8px;align-items:center;font-size:13px;">
                          <input type="checkbox" data-home-visibility="${key}" ${settings.homeVisibility?.[key] !== false ? 'checked' : ''} /> ${label}
                        </label>
                      `).join('')}
                    </div>
                  </fieldset>
                `).join('')}
              </div>
            </details>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
              <div class="form-group"><label class="form-label">عنوان الشريط فوق الهيرو (عربي)</label><input id="set-hero-tagline-ar" class="form-input" value="${settings.heroTaglineAr || ''}" /></div>
              <div class="form-group"><label class="form-label">عنوان الشريط فوق الهيرو (إنجليزي)</label><input id="set-hero-tagline-en" class="form-input" value="${settings.heroTagline || ''}" /></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:var(--space-md);">
              <div class="form-group"><label class="form-label">نص الزر الثاني (عربي)</label><input id="set-hero-cta2-ar" class="form-input" value="${settings.heroCtaSecondaryTextAr || ''}" /></div>
              <div class="form-group"><label class="form-label">نص الزر الثاني (إنجليزي)</label><input id="set-hero-cta2-en" class="form-input" value="${settings.heroCtaSecondaryText || ''}" /></div>
              <div class="form-group"><label class="form-label">رابط الزر الأول</label><input id="set-hero-cta-link" class="form-input" value="${settings.heroCtaLink || '#shop'}" /></div>
              <div class="form-group"><label class="form-label">رابط الزر الثاني</label><input id="set-hero-cta2-link" class="form-input" value="${settings.heroCtaSecondaryLink || '#shop'}" /></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
              <div class="form-group"><label class="form-label">البريد الإلكتروني</label><input type="email" id="set-email" class="form-input" value="${settings.contactEmail || ''}" /></div>
              <div class="form-group"><label class="form-label">رقم الهاتف</label><input type="text" id="set-phone" class="form-input" value="${settings.contactPhone || ''}" /></div>
            </div>
            <div class="form-group"><label class="form-label">عنوان المتجر</label><input type="text" id="set-address" class="form-input" value="${settings.address || ''}" /></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-md);">
              <div class="form-group">
                <label class="form-label">حد الشحن المجاني (ج.م)</label>
                <input type="number" id="set-free-ship" class="form-input" value="${settings.freeShippingThreshold || 1500}" />
              </div>
              <div class="form-group">
                <label class="form-label">رقم واتساب خدمة العملاء Concierge</label>
                <input type="text" id="set-whatsapp" class="form-input" value="${settings.whatsappNumber || ''}" />
              </div>
              <div class="form-group">
                <label class="form-label">نسبة الضريبة المضافة (%)</label>
                <input type="number" id="set-tax" class="form-input" value="${settings.taxPercentage || 5}" />
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-md);">
              <div class="form-group"><label class="form-label">تكلفة الشحن الافتراضية (ج.م)</label><input type="number" id="set-default-shipping" class="form-input" value="${settings.defaultShippingCost ?? 65}" /></div>
              <div class="form-group"><label class="form-label">رمز العملة للإنجليزية</label><input type="text" id="set-currency" class="form-input" value="${settings.currency || 'EGP'}" /></div>
              <div class="form-group"><label class="form-label">رمز العملة للعربية</label><input type="text" id="set-currency-ar" class="form-input" value="${settings.currencyAr || 'ج.م'}" /></div>
            </div>
            <div class="form-group"><label class="form-label"><input type="checkbox" id="set-tax-active" ${settings.enableTax ? 'checked' : ''} /> تفعيل إضافة الضريبة إلى الطلبات</label></div>

            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-md);">
              <div class="form-group"><label class="form-label">رابط Instagram</label><input type="url" id="set-social-instagram" class="form-input" value="${settings.socialInstagram || ''}" /></div>
              <div class="form-group"><label class="form-label">رابط Facebook</label><input type="url" id="set-social-facebook" class="form-input" value="${settings.socialFacebook || ''}" /></div>
              <div class="form-group"><label class="form-label">رابط TikTok</label><input type="url" id="set-social-tiktok" class="form-input" value="${settings.socialTiktok || ''}" /></div>
            </div>

            <details class="admin-card" style="padding:var(--space-lg);">
              <summary style="cursor:pointer;font-weight:700;font-size:16px;">تحرير كل النصوص الثابتة للهيدر والفوتر والصفحة الرئيسية</summary>
              <p style="margin:8px 0 16px;color:var(--color-text-muted);font-size:12px;">تُحفظ النصوص مستقلة بالعربية والإنجليزية، وتشمل الروابط وأقسام الصفحة الرئيسية.</p>
              ${CMS_CONTENT_GROUPS.map(group => `
                <details style="padding:12px 0;border-top:1px solid var(--color-border);">
                  <summary style="cursor:pointer;font-weight:700;">${group.title} (${group.fields.length})</summary>
                  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:12px;">
                    ${group.fields.map(field => `
                      <div class="form-group">
                        <label class="form-label">${field.label}</label>
                        ${field.key === 'home.story.image' || field.key.startsWith('home.social.image.')
                          ? (() => {
                              const inputId = `cms-image-${field.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
                              const previewId = `${inputId}-preview`;
                              const value = settings.siteContent?.[field.key] ?? field.fallback;
                              return `<input id="${inputId}" class="form-input" data-cms-key="${field.key}" value="${value}" />
                                <label class="btn btn-secondary btn-sm" style="cursor:pointer;display:inline-flex;margin-top:8px;">رفع صورة من الجهاز<input type="file" accept="image/*" data-image-upload-for="${inputId}" data-image-preview="${previewId}" style="display:none;" /></label>
                                <img id="${previewId}" src="${value}" alt="معاينة الصورة" style="display:block;width:100%;max-width:180px;height:90px;object-fit:cover;border-radius:6px;margin-top:8px;" />`;
                            })()
                          : field.multiline
                            ? `<textarea class="form-textarea" rows="3" data-cms-key="${field.key}">${settings.siteContent?.[field.key] ?? field.fallback}</textarea>`
                            : `<input class="form-input" data-cms-key="${field.key}" value="${settings.siteContent?.[field.key] ?? field.fallback}" />`}
                      </div>
                    `).join('')}
                  </div>
                </details>
              `).join('')}
            </details>

            <button type="submit" class="btn btn-primary" style="align-self: flex-start; padding: 12px 28px; font-weight: 700;">
              حفظ وتطبيق إعدادات المتجر في فايربيز
            </button>
          </form>
        </div>
      `;

    case 'customers': {
      const customersMap = new Map();
      orders.forEach((o: any) => {
        const key = o.customerPhone || o.customerEmail || o.customerName;
        if (!key) return;
        if (!customersMap.has(key)) {
          customersMap.set(key, {
            name: o.customerName,
            phone: o.customerPhone,
            email: o.customerEmail,
            city: o.shippingAddress?.city || o.shippingZoneName || 'القاهرة',
            ordersCount: 0,
            totalSpent: 0,
            lastOrderDate: o.createdAt
          });
        }
        const c = customersMap.get(key);
        c.ordersCount += 1;
        c.totalSpent += (o.total || 0);
        if (new Date(o.createdAt) > new Date(c.lastOrderDate)) {
          c.lastOrderDate = o.createdAt;
        }
      });
      const customersList = Array.from(customersMap.values());

      return `
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <h3 style="font-size: 17px; font-weight: 700;">قاعدة بيانات العملاء المسجلين (${customersList.length})</h3>
              <p style="font-size: 12px; color: #64748b;">سجلات الشراء، بيانات الاتصال، وإجمالي الإنفاق للعملاء</p>
            </div>
          </div>
          <div class="admin-table-scroll"><table class="admin-table">
            <thead>
              <tr>
                <th>اسم العميل</th>
                <th>رقم الهاتف</th>
                <th>البريد الإلكتروني</th>
                <th>المنطقة / المحافظة</th>
                <th>عدد الطلبات</th>
                <th>إجمالي المشتريات</th>
                <th>آخر طلب</th>
                <th>تواصل</th>
              </tr>
            </thead>
            <tbody>
              ${customersList.length === 0 ? `
                <tr><td colspan="8" style="text-align: center; padding: 24px;">لا يوجد عملاء مسجلين حتى الآن.</td></tr>
              ` : customersList.map((c: any) => `
                <tr>
                  <td><strong>${c.name}</strong></td>
                  <td><code>${c.phone}</code></td>
                  <td>${c.email || '—'}</td>
                  <td>${c.city}</td>
                  <td><span style="font-weight: 700; color: #0f172a;">${c.ordersCount} طلبات</span></td>
                  <td><strong style="color: #15803d;">${state.formatPrice(c.totalSpent)}</strong></td>
                  <td style="font-size: 12px; color: #64748b;">${new Date(c.lastOrderDate).toLocaleDateString('ar-EG')}</td>
                  <td>
                    ${c.phone ? `
                      <a href="https://wa.me/${c.phone.replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-ghost btn-sm" style="color: #16a34a; font-weight: 700; font-size: 12px;">
                        واتساب ↗
                      </a>
                    ` : '—'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        </div>
      `;
    }

    case 'shipping':
      return `
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <h3 style="font-size: 17px; font-weight: 700;">مناطق وأسعار الشحن في مصر (${shippingZones.length})</h3>
              <p style="font-size: 12px; color: #64748b;">إدارة تكلفة التوصيل، مدة الشحن المتوقعة، وتفعيل المناطق</p>
            </div>
            <button id="admin-add-zone-btn" class="btn btn-primary btn-sm" style="font-size: 12px;">+ إضافة منطقة جديدة</button>
          </div>
          <div class="admin-table-scroll"><table class="admin-table">
            <thead>
              <tr>
                <th>المنطقة والمحافظات</th>
                <th>الاسم الإنجليزي</th>
                <th>تكلفة التوصيل</th>
                <th>مدة التوصيل المتوقعة</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${shippingZones.length === 0 ? `
                <tr><td colspan="6" style="text-align: center; padding: 24px;">لا توجد مناطق شحن مسجلة.</td></tr>
              ` : shippingZones.map((z: any) => `
                <tr>
                  <td><strong>${z.nameAr || z.name}</strong></td>
                  <td style="color: #64748b;">${z.name}</td>
                  <td><strong style="color: #0f172a;">${state.formatPrice(z.cost)}</strong></td>
                  <td>${z.estimatedDaysAr || z.estimatedDays || '1-3 أيام'}</td>
                  <td><span class="status-pill ${z.isActive !== false ? 'delivered' : 'cancelled'}">${z.isActive !== false ? 'مفعل' : 'معطل'}</span></td>
                  <td>
                    <button class="admin-toggle-zone-btn btn btn-ghost btn-sm" data-id="${z.id}" data-active="${z.isActive !== false}" style="font-size: 12px; font-weight: 600;">
                      ${z.isActive !== false ? 'تعطيل' : 'تفعيل'}
                    </button>
                    <button type="button" class="admin-edit-zone-btn btn btn-secondary btn-sm" data-id="${z.id}" style="font-size:12px;">تعديل</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        </div>
      `;

    case 'reviews':
      return `
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <h3 style="font-size: 17px; font-weight: 700;">تقييمات وآراء العملاء (${reviews.length})</h3>
              <p style="font-size: 12px; color: #64748b;">مراجعة واعتماد تعليقات المشترين قبل ظهورها على صفحة المنتج</p>
            </div>
          </div>
          <div class="admin-table-scroll"><table class="admin-table">
            <thead>
              <tr>
                <th>اسم العميل</th>
                <th>التقييم</th>
                <th>التعليق والملاحظات</th>
                <th>التاريخ</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${reviews.length === 0 ? `
                <tr><td colspan="6" style="text-align: center; padding: 24px;">لا توجد تقييمات واردة حتى الآن.</td></tr>
              ` : reviews.map((rv: any) => `
                <tr>
                  <td>
                    <strong>${rv.customerName}</strong>
                    <div style="font-size: 11px; color: #64748b;">${rv.customerEmail || ''}</div>
                  </td>
                  <td>
                    <span style="color: #22c55e; font-size: 14px;">${'★'.repeat(rv.rating || 5)}</span>
                  </td>
                  <td style="max-width: 320px; font-size: 13px;">
                    <div style="font-weight: 600; color: #0f172a;">${rv.title || ''}</div>
                    <div style="color: #475569; margin-top: 2px;">${rv.comment}</div>
                  </td>
                  <td style="font-size: 12px; color: #64748b;">${new Date(rv.createdAt || Date.now()).toLocaleDateString('ar-EG')}</td>
                  <td><span class="status-pill ${rv.isApproved ? 'delivered' : 'new'}">${rv.isApproved ? 'معتمد ومنشور' : 'بانتظار المراجعة'}</span></td>
                  <td>
                    <div style="display: flex; gap: 6px;">
                      <button class="admin-toggle-review-btn btn btn-ghost btn-sm" data-id="${rv.id}" data-approved="${rv.isApproved}" style="color: #15803d; font-size: 12px; font-weight: 600;">
                        ${rv.isApproved ? 'إلغاء النشر' : 'اعتماد ونشر'}
                      </button>
                      <button class="admin-edit-review-btn btn btn-secondary btn-sm" data-id="${rv.id}" style="font-size:11px;">تعديل</button>
                      <button class="admin-del-review-btn btn btn-ghost btn-sm" data-id="${rv.id}" style="color: #b91c1c; font-size: 12px; font-weight: 600;">حذف</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        </div>
      `;

    case 'reports': {
      const codOrders = orders.filter((o: any) => o.paymentMethod === 'cod');
      const vfOrders = orders.filter((o: any) => o.paymentMethod === 'vodafone_cash');
      const totalUnitsSold = orders.reduce((sum: number, o: any) => sum + (o.items || []).reduce((isum: number, i: any) => isum + (i.quantity || 1), 0), 0);

      return `
        <!-- Reports KPI Strip -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-lg); margin-bottom: var(--space-2xl);" class="kpi-grid">
          <div class="admin-card" style="padding: var(--space-lg); margin-bottom: 0;">
            <span style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">إجمالي المبيعات المحققة</span>
            <div style="font-size: 26px; font-weight: 700; color: #0f172a; margin-top: 4px;">${state.formatPrice(totalRevenue)}</div>
            <div style="font-size: 12px; color: #16a34a; margin-top: 4px;">صافي الطلبات غير الملغاة</div>
          </div>

          <div class="admin-card" style="padding: var(--space-lg); margin-bottom: 0;">
            <span style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">إجمالي القطع المباعة</span>
            <div style="font-size: 26px; font-weight: 700; color: #0f172a; margin-top: 4px;">${totalUnitsSold} قطعة</div>
            <div style="font-size: 12px; color: #15803d; margin-top: 4px;">عبر واجهة المتجر الإلكتروني</div>
          </div>

          <div class="admin-card" style="padding: var(--space-lg); margin-bottom: 0;">
            <span style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">الدفع عند الاستلام (COD)</span>
            <div style="font-size: 26px; font-weight: 700; color: #0f172a; margin-top: 4px;">${codOrders.length} طلب</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${state.formatPrice(codOrders.reduce((s: number, o: any) => s + (o.total || 0), 0))}</div>
          </div>

          <div class="admin-card" style="padding: var(--space-lg); margin-bottom: 0;">
            <span style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">محافظ إلكترونية / فودافون كاش</span>
            <div style="font-size: 26px; font-weight: 700; color: #0f172a; margin-top: 4px;">${vfOrders.length} طلب</div>
            <div style="font-size: 12px; color: #16a34a; margin-top: 4px;">${state.formatPrice(vfOrders.reduce((s: number, o: any) => s + (o.total || 0), 0))}</div>
          </div>
        </div>

        <!-- Breakdown Details -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-xl);">
          <div class="admin-card" style="padding: var(--space-xl);">
            <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
              أعلى المنتجات مبيعاً بالمتجر
            </h4>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${products.slice(0, 5).map((p: any, idx: number) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f8fafc; border-radius: 6px;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight: 800; color: #94a3b8; font-size: 14px;">#${idx + 1}</span>
                    <div>
                      <strong style="font-size: 13px;">${p.nameAr || p.name}</strong>
                      <div style="font-size: 11px; color: #64748b;">SKU: ${p.sku}</div>
                    </div>
                  </div>
                  <strong style="color: #0f172a;">${state.formatPrice(p.salePrice || p.price)}</strong>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="admin-card" style="padding: var(--space-xl);">
            <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
              توزيع الطلبات حسب مناطق ومحافظات مصر
            </h4>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${shippingZones.map((z: any) => {
                const count = orders.filter((o: any) => o.shippingZoneName?.includes(z.nameAr) || o.shippingAddress?.governorate === z.id).length;
                return `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f8fafc; border-radius: 6px;">
                    <div>
                      <strong style="font-size: 13px;">${z.nameAr || z.name}</strong>
                      <div style="font-size: 11px; color: #64748b;">تكلفة التوصيل: ${state.formatPrice(z.cost)}</div>
                    </div>
                    <span style="background: #e2e8f0; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700;">${count} طلبات</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    }

    default:
      return renderAdminSection('overview', data);
  }
}

function getStatusArabic(status: string): string {
  const map: Record<string, string> = {
    new: 'طلب جديد',
    confirmed: 'مؤكد',
    processing: 'قيد التجهيز بالأتليه',
    shipped: 'تم الشحن الجوي',
    delivered: 'تم التوصيل والإنهاء',
    cancelled: 'ملغي ومسترجع'
  };
  return map[status] || status;
}

// Security Gate Login View in Arabic with Cairo Font
export function renderAdminLoginView(): string {
  return `
    <div class="admin-login-layout" dir="rtl" style="min-height: 100vh; background-color: #0b0f19; display: flex; align-items: center; justify-content: center; padding: var(--space-xl); font-family: 'Cairo', sans-serif;">
      
      <div style="max-width: 440px; width: 100%; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 36px 32px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); color: #ffffff;">
        
        <!-- Brand & Security Header -->
        <div style="text-align: center; margin-bottom: 28px;">
          <div style="margin-bottom: 16px;">
            <img src="/assets/logo-white.png" alt="EIGHTY-EIGHT" style="height: 52px; width: auto; max-width: 200px; object-fit: contain; margin: 0 auto; display: block;" />
          </div>
          
          <span style="font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--color-brand-gold); display: block; margin-bottom: 6px; font-weight: 700;">
            EIGHTY-EIGHT • لوحة التحكم الإدارية
          </span>
          <h3 style="font-size: 22px; font-weight: 800; color: #ffffff;">
            تسجيل دخول مدير المتجر
          </h3>
          <p style="font-size: 13px; color: #94a3b8; margin-top: 6px; line-height: 1.6;">
            منطقة أمنية مخصصة لإدارة المنتجات، الطلبات، المخزون، والوسائط.
          </p>
        </div>

        <!-- Admin Login Form (No visible credentials) -->
        <form id="admin-login-form" style="display: flex; flex-direction: column; gap: 18px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="color: #cbd5e1; font-weight: 600; font-size: 13px;">البريد الإلكتروني المعتمد للإدارة *</label>
            <input 
              type="email" 
              id="adm-login-email" 
              required 
              class="form-input" 
              value="" 
              placeholder="name@example.com" 
              style="background: #0b0f19; border-color: #334155; color: #ffffff; direction: ltr; text-align: left; padding: 12px 14px; border-radius: 10px;" 
            />
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="color: #cbd5e1; font-weight: 600; font-size: 13px;">كلمة المرور (الباسوورد) *</label>
            <input 
              type="password" 
              id="adm-login-password" 
              required 
              class="form-input" 
              value="" 
              placeholder="••••••••" 
              style="background: #0b0f19; border-color: #334155; color: #ffffff; direction: ltr; padding: 12px 14px; border-radius: 10px;" 
            />
          </div>

          <button type="submit" id="adm-submit-btn" class="btn btn-gold btn-full" style="padding: 13px; margin-top: 6px; font-weight: 700; font-size: 14px; border-radius: 12px;">
            🔒 تسجيل الدخول إلى لوحة التحكم
          </button>
        </form>

        <!-- Back to Storefront Link -->
        <div style="margin-top: 24px; text-align: center; border-top: 1px solid #1e293b; padding-top: 16px;">
          <a href="#home" style="font-size: 13px; color: #94a3b8; text-decoration: underline;">
            ← الرجوع للمتجر الإلكتروني للعملاء
          </a>
        </div>

      </div>

    </div>
  `;
}

export function setupAdminEvents(section: string) {
  const isAdmin = state.isAdmin();

  // If in login view
  if (!isAdmin || section === 'login') {
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) {
      loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = (document.getElementById('adm-login-email') as HTMLInputElement).value.trim();
        const pass = (document.getElementById('adm-login-password') as HTMLInputElement).value;
        const submitBtn = document.getElementById('adm-submit-btn') as HTMLButtonElement;

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = 'جاري التحقق الأمني...';

          // Call backend admin login endpoint
          const res = await fetch('/api/auth/admin-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pass })
          });
          const data = await res.json();

          if (data.success && data.user) {
            state.setCurrentUser(data.user, true);
            invalidateAdminCache();
            showToast('تم تسجيل الدخول بنجاح كمدير لبراند EIGHTY-EIGHT!', 'success');
            window.location.hash = 'admin/overview';
            return;
          }

          // Fallback Firebase Auth check
          try {
            const cred = await signInWithEmailAndPassword(auth, email, pass);
            if (cred.user.email?.toLowerCase() === 'muhammedadel.dev@gmail.com') {
              state.setCurrentUser(cred.user, true);
              invalidateAdminCache();
              showToast('تم تسجيل الدخول بنجاح!', 'success');
              window.location.hash = 'admin/overview';
              return;
            }
          } catch {}

          throw new Error(data.message || 'بيانات الدخول غير صحيحة أو غير مصرح لها');
        } catch (err: any) {
          showToast(err.message, 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = '🔒 تسجيل الدخول إلى لوحة التحكم';
        }
      };
    }

    return;
  }

  bindImageUploadControls(document);

  // Admin Logout Button Handler
  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      try {
        await signOut(auth);
      } catch (e) {
        // ignore
      }
      state.setCurrentUser(null, false);
      invalidateAdminCache();
      showToast('تم تسجيل الخروج من لوحة التحكم بنجاح', 'info');
      window.location.hash = 'admin/login';
    };
  }

  // Refresh data button handler
  const refreshBtn = document.getElementById('admin-refresh-data-btn');
  if (refreshBtn) {
    refreshBtn.onclick = () => {
      invalidateAdminCache();
      showToast('جاري تحديث البيانات من السيرفر...', 'info');
      refreshAdminSection(section);
    };
  }

  // Sidebar mobile toggle
  const sidebarToggle = document.getElementById('admin-sidebar-toggle');
  const sidebar = document.getElementById('admin-sidebar');
  const sidebarBackdrop = document.getElementById('admin-sidebar-backdrop');

  function toggleAdminSidebar() {
    if (window.innerWidth > 900) return;
    if (sidebar) {
      sidebar.classList.toggle('open');
      if (sidebarBackdrop) sidebarBackdrop.classList.toggle('open');
    }
  }

  function closeAdminSidebar() {
    if (sidebar) {
      sidebar.classList.remove('open');
      if (sidebarBackdrop) sidebarBackdrop.classList.remove('open');
    }
  }

  if (sidebarToggle) {
    sidebarToggle.onclick = toggleAdminSidebar;
  }
  if (sidebarBackdrop) {
    sidebarBackdrop.onclick = closeAdminSidebar;
  }

  // Close sidebar on mobile when an item is tapped
  if (sidebar) {
    sidebar.querySelectorAll('.admin-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 900) closeAdminSidebar();
      });
    });
  }

  // Shipping section events
  if (section === 'shipping') {
    document.querySelectorAll('.admin-edit-zone-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (!id) return;
        try {
          const snap = await getDoc(doc(db, 'shippingZones', id));
          if (!snap.exists()) throw new Error('لم يتم العثور على منطقة الشحن');
          const zone = snap.data();
          openModal(`
            <h3 style="font-size:20px;font-weight:700;margin-bottom:16px;">تعديل منطقة الشحن</h3>
            <form id="edit-zone-form" style="display:flex;flex-direction:column;gap:var(--space-md);">
              <div class="form-group"><label class="form-label">اسم المنطقة بالعربية</label><input id="ez-name-ar" class="form-input" value="${zone.nameAr || ''}" required /></div>
              <div class="form-group"><label class="form-label">اسم المنطقة بالإنجليزية</label><input id="ez-name-en" class="form-input" value="${zone.name || ''}" required /></div>
              <div class="form-group"><label class="form-label">تكلفة الشحن (ج.م)</label><input id="ez-cost" class="form-input" type="number" min="0" value="${zone.cost || 0}" required /></div>
              <div class="form-group"><label class="form-label">مدة التوصيل بالعربية</label><input id="ez-days-ar" class="form-input" value="${zone.estimatedDaysAr || zone.estimatedDays || ''}" /></div>
              <div class="form-group"><label class="form-label">مدة التوصيل بالإنجليزية</label><input id="ez-days-en" class="form-input" value="${zone.estimatedDays || ''}" /></div>
              <div class="form-group"><label class="form-label">المحافظات المشمولة (مفصولة بفواصل)</label><input id="ez-governorates" class="form-input" value="${(zone.governorates || []).join(', ')}" /></div>
              <label><input id="ez-active" type="checkbox" ${zone.isActive !== false ? 'checked' : ''} /> المنطقة مفعلة</label>
              <button type="submit" class="btn btn-primary btn-full">حفظ التعديلات</button>
            </form>
          `);
          const form = document.getElementById('edit-zone-form');
          if (form) form.onsubmit = async (submitEvent) => {
            submitEvent.preventDefault();
            try {
              await updateDoc(doc(db, 'shippingZones', id), {
                nameAr: (document.getElementById('ez-name-ar') as HTMLInputElement).value.trim(),
                name: (document.getElementById('ez-name-en') as HTMLInputElement).value.trim(),
                cost: Number((document.getElementById('ez-cost') as HTMLInputElement).value) || 0,
                estimatedDaysAr: (document.getElementById('ez-days-ar') as HTMLInputElement).value.trim(),
                estimatedDays: (document.getElementById('ez-days-en') as HTMLInputElement).value.trim(),
                governorates: (document.getElementById('ez-governorates') as HTMLInputElement).value.split(',').map(v => v.trim()).filter(Boolean),
                isActive: (document.getElementById('ez-active') as HTMLInputElement).checked,
                updatedAt: new Date().toISOString()
              });
              invalidateAdminCache();
              closeModal();
              showToast('تم تعديل منطقة الشحن بنجاح', 'success');
              refreshAdminSection(section);
            } catch (error: any) { showToast(error.message, 'error'); }
          };
        } catch (error: any) { showToast(error.message, 'error'); }
      });
    });

    document.querySelectorAll('.admin-toggle-zone-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        const active = (e.currentTarget as HTMLElement).getAttribute('data-active') === 'true';
        if (id) {
          try {
            await updateDoc(doc(db, 'shippingZones', id), { isActive: !active });
            invalidateAdminCache();
            showToast('تم تحديث حالة منطقة الشحن', 'success');
            refreshAdminSection(section);
          } catch (err: any) {
            showToast(err.message, 'error');
          }
        }
      });
    });

    const addZoneBtn = document.getElementById('admin-add-zone-btn');
    if (addZoneBtn) {
      addZoneBtn.onclick = () => {
        openModal(`
          <div style="font-family: 'Cairo', sans-serif;" dir="rtl">
            <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">إضافة منطقة شحن جديدة</h3>
            <form id="add-zone-form" style="display: flex; flex-direction: column; gap: 14px;">
              <div class="form-group">
                <label class="form-label">اسم المنطقة بالعربية *</label>
                <input type="text" id="zone-name-ar" required class="form-input" placeholder="مثال: مطروح والوادي الجديد" />
              </div>
              <div class="form-group">
                <label class="form-label">اسم المنطقة بالإنجليزية *</label>
                <input type="text" id="zone-name-en" required class="form-input" placeholder="e.g. Matrouh & New Valley" />
              </div>
              <div class="form-group">
                <label class="form-label">تكلفة الشحن (ج.م) *</label>
                <input type="number" id="zone-cost" required class="form-input" value="100" />
              </div>
              <div class="form-group">
                <label class="form-label">مدة التوصيل المتوقعة *</label>
                <input type="text" id="zone-days" required class="form-input" value="3-5 أيام عمل" />
              </div>
              <button type="submit" class="btn btn-primary" style="padding: 12px; font-weight: 700;">حفظ المنطقة</button>
            </form>
          </div>
        `);

        const zoneForm = document.getElementById('add-zone-form');
        if (zoneForm) {
          zoneForm.onsubmit = async (e) => {
            e.preventDefault();
            const nameAr = (document.getElementById('zone-name-ar') as HTMLInputElement).value.trim();
            const nameEn = (document.getElementById('zone-name-en') as HTMLInputElement).value.trim();
            const cost = Number((document.getElementById('zone-cost') as HTMLInputElement).value) || 0;
            const days = (document.getElementById('zone-days') as HTMLInputElement).value.trim();

            const zoneId = 'zone-' + Date.now().toString().slice(-6);
            await setDoc(doc(db, 'shippingZones', zoneId), {
              id: zoneId,
              name: nameEn,
              nameAr,
              cost,
              estimatedDays: days,
              estimatedDaysAr: days,
              isActive: true
            });

            closeModal();
            invalidateAdminCache();
            showToast('تمت إضافة منطقة الشحن بنجاح!', 'success');
            refreshAdminSection(section);
          };
        }
      };
    }
  }

  // Reviews section events
  if (section === 'reviews') {
    document.querySelectorAll('.admin-edit-review-btn').forEach(button => {
      button.addEventListener('click', async (event) => {
        const id = (event.currentTarget as HTMLElement).getAttribute('data-id');
        if (!id) return;
        try {
          const snap = await getDoc(doc(db, 'reviews', id));
          if (!snap.exists()) throw new Error('لم يتم العثور على التقييم');
          const review = snap.data();
          openModal(`
            <h3 style="font-size:20px;font-weight:700;margin-bottom:16px;">تعديل تقييم العميل</h3>
            <form id="edit-review-form" style="display:flex;flex-direction:column;gap:var(--space-md);">
              <div class="form-group"><label class="form-label">اسم العميل</label><input id="erv-name" class="form-input" value="${review.customerName || ''}" /></div>
              <div class="form-group"><label class="form-label">البريد الإلكتروني</label><input id="erv-email" type="email" class="form-input" value="${review.customerEmail || ''}" /></div>
              <div class="form-group"><label class="form-label">عنوان التقييم</label><input id="erv-title" class="form-input" value="${review.title || ''}" /></div>
              <div class="form-group"><label class="form-label">نص التقييم</label><textarea id="erv-comment" class="form-textarea" rows="5" required>${review.comment || ''}</textarea></div>
              <div class="form-group"><label class="form-label">التقييم من 1 إلى 5</label><input id="erv-rating" type="number" min="1" max="5" class="form-input" value="${review.rating || 5}" /></div>
              <label><input id="erv-approved" type="checkbox" ${review.isApproved ? 'checked' : ''} /> التقييم معتمد ومنشور</label>
              <button class="btn btn-primary btn-full" type="submit">حفظ التعديلات</button>
            </form>
          `);
          const form = document.getElementById('edit-review-form');
          if (form) form.onsubmit = async (submitEvent) => {
            submitEvent.preventDefault();
            try {
              await updateDoc(doc(db, 'reviews', id), {
                customerName: (document.getElementById('erv-name') as HTMLInputElement).value.trim(),
                customerEmail: (document.getElementById('erv-email') as HTMLInputElement).value.trim(),
                title: (document.getElementById('erv-title') as HTMLInputElement).value.trim(),
                comment: (document.getElementById('erv-comment') as HTMLTextAreaElement).value.trim(),
                rating: Math.min(5, Math.max(1, Number((document.getElementById('erv-rating') as HTMLInputElement).value) || 5)),
                isApproved: (document.getElementById('erv-approved') as HTMLInputElement).checked,
                updatedAt: new Date().toISOString()
              });
              invalidateAdminCache();
              closeModal();
              showToast('تم تحديث التقييم بنجاح', 'success');
              refreshAdminSection(section);
            } catch (error: any) { showToast(error.message, 'error'); }
          };
        } catch (error: any) { showToast(error.message, 'error'); }
      });
    });

    document.querySelectorAll('.admin-toggle-review-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        const approved = (e.currentTarget as HTMLElement).getAttribute('data-approved') === 'true';
        if (id) {
          try {
            await updateDoc(doc(db, 'reviews', id), { isApproved: !approved });
            invalidateAdminCache();
            showToast('تم تحديث حالة نشر التقييم', 'success');
            refreshAdminSection(section);
          } catch (err: any) {
            showToast(err.message, 'error');
          }
        }
      });
    });

    document.querySelectorAll('.admin-del-review-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (id && confirm('هل أنت متأكد من حذف هذا التقييم؟')) {
          try {
            await deleteDoc(doc(db, 'reviews', id));
            invalidateAdminCache();
            showToast('تم حذف التقييم بنجاح', 'info');
            refreshAdminSection(section);
          } catch (err: any) {
            showToast(err.message, 'error');
          }
        }
      });
    });
  }

  // MEDIA SECTION EVENTS (Free Uploads)
  if (section === 'media') {
    const bulkInput = document.getElementById('media-bulk-upload-input') as HTMLInputElement;
    const dropzone = document.getElementById('media-dropzone');

    if (dropzone && bulkInput) {
      dropzone.onclick = () => bulkInput.click();

      dropzone.ondragover = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--color-brand-gold)';
        dropzone.style.background = 'rgba(197, 160, 89, 0.05)';
      };

      dropzone.ondragleave = () => {
        dropzone.style.borderColor = '#cbd5e1';
        dropzone.style.background = '#f8fafc';
      };

      dropzone.ondrop = async (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#cbd5e1';
        dropzone.style.background = '#f8fafc';
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          await handleFilesUpload(files);
        }
      };
    }

    if (bulkInput) {
      bulkInput.onchange = async () => {
        if (bulkInput.files && bulkInput.files.length > 0) {
          await handleFilesUpload(bulkInput.files);
        }
      };
    }

    async function handleFilesUpload(files: FileList) {
      showToast(`جاري رفع ${files.length} صورة من جهازك مجاناً...`, 'info');
      try {
        for (let i = 0; i < files.length; i++) {
          await uploadImageFile(files[i]);
        }
        showToast('تم رفع جميع الصور إلى Cloudinary وحفظها في مكتبة الوسائط!', 'success');
        refreshAdminSection(section);
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    }

    // Copy URL button
    document.querySelectorAll('.admin-copy-url-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const url = (e.currentTarget as HTMLElement).getAttribute('data-url');
        if (url) {
          navigator.clipboard.writeText(url);
          showToast('تم نسخ الرابط المباشر للصورة!', 'success');
        }
      });
    });

    // Delete Media item
    document.querySelectorAll('.admin-del-media-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (id && confirm('هل أنت متأكد من حذف هذه الصورة؟')) {
          try {
            const res = await fetch(`/api/media/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
              showToast('تم حذف الصورة بنجاح', 'info');
              refreshAdminSection(section);
            } else {
              showToast(data.message, 'error');
            }
          } catch (err: any) {
            showToast(err.message, 'error');
          }
        }
      });
    });
  }

  // Add Product Modal with Free File Upload
  const addProdBtn = document.getElementById('admin-add-product-btn');
  if (addProdBtn) {
    addProdBtn.onclick = () => {
      openModal(`
        <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">إضافة قطعة أزياء كوتور جديدة</h3>
        <form id="new-prod-form" style="display: flex; flex-direction: column; gap: var(--space-md);">
          <div class="form-group">
            <label class="form-label">اسم القطعة (بالعربية) *</label>
            <input type="text" id="np-name-ar" required class="form-input" placeholder="مثال: فستان جورجيت الحريري الملكي" />
          </div>
          <div class="form-group">
            <label class="form-label">اسم القطعة (بالإنجليزية) *</label>
            <input type="text" id="np-name-en" required class="form-input" placeholder="e.g. Silk Georgette Evening Dress" />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);">
            <div class="form-group">
              <label class="form-label">كود القطعة (SKU) *</label>
              <input type="text" id="np-sku" required class="form-input" placeholder="LET-DR-101" />
            </div>
            <div class="form-group">
              <label class="form-label">السعر الأساسي (ج.م) *</label>
              <input type="number" id="np-price" required class="form-input" placeholder="850" />
            </div>
          </div>

          <!-- Free Upload or URL -->
          <div class="form-group">
            <label class="form-label">صورة القطعة (ارفعها من جهازك، والرابط اختياري) *</label>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="np-img" required class="form-input" style="flex: 1;" placeholder="/uploads/... أو رابط الصورة" value="https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=1000&q=85" />
              <label class="btn btn-secondary btn-sm" style="cursor: pointer; display: flex; align-items: center; gap: 4px; white-space: nowrap;">
                <span>📷 رفع من جهازك</span>
                <input type="file" id="np-file-upload" accept="image/*" style="display: none;" />
              </label>
            </div>
            <div id="np-preview-box" style="margin-top: 8px; display: none; align-items: center; gap: 10px;">
              <img id="np-preview-img" src="" style="width: 60px; height: 80px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1;" />
              <span style="font-size: 12px; color: #16a34a; font-weight: 600;">✓ تم رفع الصورة بنجاح</span>
            </div>
            <label class="form-label" style="display:block;margin-top:12px;">صور إضافية للمنتج</label>
            <textarea id="np-extra-images" class="form-textarea" rows="2" placeholder="اختياري: ارفع صوراً متعددة أو الصق رابطاً لكل صورة"></textarea>
            <label class="btn btn-secondary btn-sm" style="cursor:pointer;display:inline-flex;margin-top:8px;">رفع صور إضافية من الجهاز<input type="file" accept="image/*" multiple data-image-upload-for="np-extra-images" data-image-upload-mode="append-lines" style="display:none;" /></label>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);"><div class="form-group"><label class="form-label">التصنيف</label><input type="text" id="np-category" class="form-input" placeholder="هوديز، تيشيرتات، جاكيتات" /></div><div class="form-group"><label class="form-label">سعر التخفيض</label><input type="number" id="np-saleprice" class="form-input" value="0" /></div></div>
          <div class="form-group"><label class="form-label">المقاسات (افصل بينها بفاصلة) *</label><input type="text" id="np-sizes" required class="form-input" value="S, M, L, XL" /></div>
          <div class="form-group"><label class="form-label">الألوان (الاسم | كود اللون، كل لون في سطر) *</label><textarea id="np-colors" required class="form-textarea" rows="3">أسود | #111827</textarea></div>
          <div class="form-group"><label class="form-label">إجمالي المخزون المتاح للقطعة *</label><input type="number" id="np-stock" required class="form-input" value="25" min="0" /></div>
          <div class="form-group"><label class="form-label">الوصف بالعربية</label><textarea id="np-description-ar" class="form-textarea" rows="3"></textarea></div>
          <div class="form-group"><label class="form-label">الخامة والعناية</label><input type="text" id="np-fabric" class="form-input" placeholder="قطن مصري 100%" /><input type="text" id="np-care" class="form-input" style="margin-top:8px" placeholder="إرشادات العناية" /></div>
          <button type="submit" class="btn btn-primary btn-full" style="padding: 12px; font-weight: 700;">حفظ ونشر القطعة بالمتجر</button>
        </form>
      `);

      bindImageUploadControls(document);

      // File upload listener for new product
      const npFileInput = document.getElementById('np-file-upload') as HTMLInputElement;
      if (npFileInput) {
        npFileInput.onchange = async () => {
          const file = npFileInput.files?.[0];
          if (!file) return;
          try {
            showToast('جاري رفع صورة القطعة من جهازك مجاناً...', 'info');
            const res = await uploadImageFile(file);
            (document.getElementById('np-img') as HTMLInputElement).value = res.url;
            const pBox = document.getElementById('np-preview-box');
            const pImg = document.getElementById('np-preview-img') as HTMLImageElement;
            if (pBox && pImg) {
              pImg.src = res.url;
              pBox.style.display = 'flex';
            }
            showToast('تم رفع الصورة بنجاح وربطها بالمنتج!', 'success');
          } catch (err: any) {
            showToast(err.message, 'error');
          }
        };
      }

      const form = document.getElementById('new-prod-form');
      if (form) {
        form.onsubmit = async (ev) => {
          ev.preventDefault();
          const name = (document.getElementById('np-name-en') as HTMLInputElement).value;
          const nameAr = (document.getElementById('np-name-ar') as HTMLInputElement).value;
          const sku = (document.getElementById('np-sku') as HTMLInputElement).value;
          const price = parseFloat((document.getElementById('np-price') as HTMLInputElement).value);
          const img = (document.getElementById('np-img') as HTMLInputElement).value;
          const extraImages = (document.getElementById('np-extra-images') as HTMLTextAreaElement).value.split('\n').map(value => value.trim()).filter(Boolean);
          const stock = parseInt((document.getElementById('np-stock') as HTMLInputElement).value) || 0;
          const categoryName = (document.getElementById('np-category') as HTMLInputElement).value.trim();
          const salePrice = parseFloat((document.getElementById('np-saleprice') as HTMLInputElement).value) || 0;
          const sizes = (document.getElementById('np-sizes') as HTMLInputElement).value.split(',').map(v => v.trim()).filter(Boolean);
          const colors = parseProductColors((document.getElementById('np-colors') as HTMLTextAreaElement).value);
          const descriptionAr = (document.getElementById('np-description-ar') as HTMLTextAreaElement).value.trim();
          const fabric = (document.getElementById('np-fabric') as HTMLInputElement).value.trim();
          const careInstructions = (document.getElementById('np-care') as HTMLInputElement).value.trim();
          if (!sizes.length || !colors.length) { showToast('أضف مقاسًا ولونًا واحدًا على الأقل', 'warning'); return; }
          try {
            await addDoc(collection(db, 'products'), {
              name, nameAr, slug: sku.toLowerCase(), sku, price, salePrice, categoryName, images: [img, ...extraImages], totalStock: stock,
              descriptionAr, fabric, careInstructions, isPublished: true, isFeatured: true, isNewArrival: true, sizes, colors,
              variants: buildProductVariants(sku, sizes, colors, stock), createdAt: new Date().toISOString()
            });
            closeModal();
            showToast('تمت إضافة وحفظ القطعة بنجاح في قاعدة البيانات!', 'success');
            refreshAdminSection(section);
          } catch (err: any) {
            showToast(err.message, 'error');
          }
        };
      }
    };
  }

  // Edit Product Modal with Free File Upload
  document.querySelectorAll('.admin-edit-prod-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, 'products', id));
        if (!snap.exists()) return;
        const p = snap.data();

        openModal(`
          <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">تعديل القطعة • ${p.nameAr || p.name}</h3>
          <form id="edit-prod-form" style="display: flex; flex-direction: column; gap: var(--space-md);">
            <div class="form-group">
              <label class="form-label">اسم القطعة (بالعربية) *</label>
              <input type="text" id="ep-name-ar" required class="form-input" value="${p.nameAr || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">اسم القطعة (بالإنجليزية) *</label>
              <input type="text" id="ep-name-en" required class="form-input" value="${p.name || ''}" />
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
              <div class="form-group"><label class="form-label">SKU</label><input type="text" id="ep-sku" class="form-input" value="${p.sku || id}" /></div>
              <div class="form-group"><label class="form-label">رابط المنتج (slug)</label><input type="text" id="ep-slug" class="form-input" value="${p.slug || p.sku || id}" /></div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);">
              <div class="form-group">
                <label class="form-label">السعر الأساسي (ج.م) *</label>
                <input type="number" id="ep-price" required class="form-input" value="${p.price || 0}" />
              </div>
              <div class="form-group">
                <label class="form-label">سعر التخفيض (ج.م)</label>
                <input type="number" id="ep-saleprice" class="form-input" value="${p.salePrice || 0}" />
              </div>
            </div>
            <div class="form-group"><label class="form-label">التصنيف</label><input type="text" id="ep-category" class="form-input" value="${p.categoryName || ''}" /></div>
            <div class="form-group"><label class="form-label">المخزون الكلي *</label><input type="number" id="ep-stock" required class="form-input" value="${p.totalStock ?? 10}" min="0" /></div>
            <div class="form-group"><label class="form-label">المقاسات *</label><input type="text" id="ep-sizes" required class="form-input" value="${(p.sizes || []).join(', ')}" /></div>
            <div class="form-group"><label class="form-label">الألوان (الاسم | كود اللون) *</label><textarea id="ep-colors" required class="form-textarea" rows="3">${(p.colors || []).map((c: any) => `${c.name} | ${c.hex}`).join('\n')}</textarea></div>
            <div class="form-group"><label class="form-label">الوصف بالعربية</label><textarea id="ep-description-ar" class="form-textarea" rows="3">${p.descriptionAr || ''}</textarea></div>
            <div class="form-group"><label class="form-label">الوصف بالإنجليزية</label><textarea id="ep-description-en" class="form-textarea" rows="3">${p.description || ''}</textarea></div>
            <div class="form-group"><label class="form-label">الخامة والعناية</label><input type="text" id="ep-fabric" class="form-input" value="${p.fabric || ''}" /><input type="text" id="ep-care" class="form-input" style="margin-top:8px" value="${p.careInstructions || ''}" /></div>

            <!-- Free File Upload or URL -->
            <div class="form-group">
              <label class="form-label">صورة القطعة (ارفعها من جهازك، والرابط اختياري) *</label>
              <div style="display: flex; gap: 8px;">
                <input type="text" id="ep-img" required class="form-input" style="flex: 1;" value="${(p.images && p.images[0]) || ''}" />
                <label class="btn btn-secondary btn-sm" style="cursor: pointer; display: flex; align-items: center; gap: 4px; white-space: nowrap;">
                  <span>📷 رفع صورة جديدة</span>
                  <input type="file" id="ep-file-upload" accept="image/*" style="display: none;" />
                </label>
              </div>
              <div id="ep-preview-box" style="margin-top: 8px; display: flex; align-items: center; gap: 10px;">
                <img id="ep-preview-img" src="${(p.images && p.images[0]) || ''}" style="width: 60px; height: 80px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1;" />
              </div>
              <div class="form-group" style="margin-top:10px;">
                <label class="form-label">صور إضافية للمنتج</label>
                <textarea id="ep-extra-images" class="form-textarea" rows="3" placeholder="يمكنك رفع الصور من جهازك أو لصق رابط لكل صورة">${(p.images || []).slice(1).join('\n')}</textarea>
                <label class="btn btn-secondary btn-sm" style="cursor:pointer;display:inline-flex;margin-top:8px;">رفع صور إضافية من الجهاز<input type="file" accept="image/*" multiple data-image-upload-for="ep-extra-images" data-image-upload-mode="append-lines" style="display:none;" /></label>
              </div>
            </div>

            <div style="display:flex;gap:16px;flex-wrap:wrap;">
              <label><input type="checkbox" id="ep-featured" ${p.isFeatured ? 'checked' : ''} /> منتج مميز</label>
              <label><input type="checkbox" id="ep-newarrival" ${p.isNewArrival ? 'checked' : ''} /> وصل حديثاً</label>
              <label><input type="checkbox" id="ep-bestseller" ${p.isBestSeller ? 'checked' : ''} /> الأكثر مبيعاً</label>
            </div>

            <div class="form-group">
              <label class="form-label">حالة النشر بالمتجر</label>
              <select id="ep-published" class="form-select">
                <option value="true" ${p.isPublished ? 'selected' : ''}>منشور ومتاح للشراء للعملاء</option>
                <option value="false" ${!p.isPublished ? 'selected' : ''}>مسودة مخفية</option>
              </select>
            </div>
            <button type="submit" class="btn btn-primary btn-full" style="padding: 12px; font-weight: 700;">حفظ التعديلات في فايربيز</button>
          </form>
        `);

        bindImageUploadControls(document);

        // Free upload listener for edit
        const epFileInput = document.getElementById('ep-file-upload') as HTMLInputElement;
        if (epFileInput) {
          epFileInput.onchange = async () => {
            const file = epFileInput.files?.[0];
            if (!file) return;
            try {
              showToast('جاري رفع الصورة الجديدة مجاناً...', 'info');
              const res = await uploadImageFile(file);
              (document.getElementById('ep-img') as HTMLInputElement).value = res.url;
              const pImg = document.getElementById('ep-preview-img') as HTMLImageElement;
              if (pImg) pImg.src = res.url;
              showToast('تم رفع الصورة الجديدة بنجاح!', 'success');
            } catch (err: any) {
              showToast(err.message, 'error');
            }
          };
        }

        const editForm = document.getElementById('edit-prod-form');
        if (editForm) {
          editForm.onsubmit = async (ev) => {
            ev.preventDefault();
            const name = (document.getElementById('ep-name-en') as HTMLInputElement).value;
            const nameAr = (document.getElementById('ep-name-ar') as HTMLInputElement).value;
            const price = parseFloat((document.getElementById('ep-price') as HTMLInputElement).value);
            const salePrice = parseFloat((document.getElementById('ep-saleprice') as HTMLInputElement).value) || 0;
            const stock = parseInt((document.getElementById('ep-stock') as HTMLInputElement).value) || 0;
            const img = (document.getElementById('ep-img') as HTMLInputElement).value;
            const sku = (document.getElementById('ep-sku') as HTMLInputElement).value.trim();
            const slug = (document.getElementById('ep-slug') as HTMLInputElement).value.trim();
            const extraImages = (document.getElementById('ep-extra-images') as HTMLTextAreaElement).value.split('\n').map(v => v.trim()).filter(Boolean);
            const categoryName = (document.getElementById('ep-category') as HTMLInputElement).value.trim();
            const sizes = (document.getElementById('ep-sizes') as HTMLInputElement).value.split(',').map(v => v.trim()).filter(Boolean);
            const colors = parseProductColors((document.getElementById('ep-colors') as HTMLTextAreaElement).value);
            const descriptionAr = (document.getElementById('ep-description-ar') as HTMLTextAreaElement).value.trim();
            const description = (document.getElementById('ep-description-en') as HTMLTextAreaElement).value.trim();
            const fabric = (document.getElementById('ep-fabric') as HTMLInputElement).value.trim();
            const careInstructions = (document.getElementById('ep-care') as HTMLInputElement).value.trim();
            const isPub = (document.getElementById('ep-published') as HTMLSelectElement).value === 'true';
            if (!sizes.length || !colors.length) { showToast('أضف مقاسًا ولونًا واحدًا على الأقل', 'warning'); return; }
            try {
              await updateDoc(doc(db, 'products', id), {
                name, nameAr, sku, slug, price, salePrice, categoryName, totalStock: stock, images: [img, ...extraImages], sizes, colors,
                variants: buildProductVariants((sku || id), sizes, colors, stock), description, descriptionAr, fabric, careInstructions,
                isFeatured: (document.getElementById('ep-featured') as HTMLInputElement).checked,
                isNewArrival: (document.getElementById('ep-newarrival') as HTMLInputElement).checked,
                isBestSeller: (document.getElementById('ep-bestseller') as HTMLInputElement).checked,
                isPublished: isPub, updatedAt: new Date().toISOString()
              });
              closeModal();
              showToast('تم تحديث القطعة وحفظها بنجاح!', 'success');
              refreshAdminSection(section);
            } catch (err: any) {
              showToast(err.message, 'error');
            }
          };
        }
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    });
  });

  // Delete product
  document.querySelectorAll('.admin-del-prod-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      if (id && confirm('هل أنت متأكد من حذف هذه القطعة من الكتالوج نهائياً؟')) {
        try {
          await deleteDoc(doc(db, 'products', id));
          showToast('تم حذف القطعة من الكتالوج', 'info');
          refreshAdminSection(section);
        } catch (err: any) {
          showToast(err.message, 'error');
        }
      }
    });
  });

  // Add Category Modal with Free File Upload
  const addCatBtn = document.getElementById('admin-add-category-btn');
  if (addCatBtn) {
    addCatBtn.onclick = () => {
      openModal(`
        <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">إضافة قسم جديد للأزياء</h3>
        <form id="new-cat-form" style="display: flex; flex-direction: column; gap: var(--space-md);">
          <div class="form-group">
            <label class="form-label">اسم القسم (بالعربية) *</label>
            <input type="text" id="nc-name-ar" required class="form-input" placeholder="مثال: فساتين السهرة والأعراس" />
          </div>
          <div class="form-group">
            <label class="form-label">اسم القسم (بالإنجليزية) *</label>
            <input type="text" id="nc-name-en" required class="form-input" placeholder="e.g. Evening Gowns" />
          </div>
          <div class="form-group">
            <label class="form-label">الرابط المعرّف (Slug) *</label>
            <input type="text" id="nc-slug" required class="form-input" placeholder="evening-gowns" />
          </div>

          <!-- Free Upload or URL -->
          <div class="form-group">
            <label class="form-label">صورة القسم (ارفعها من جهازك، والرابط اختياري) *</label>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="nc-img" required class="form-input" style="flex: 1;" value="https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=80" />
              <label class="btn btn-secondary btn-sm" style="cursor: pointer; display: flex; align-items: center; gap: 4px; white-space: nowrap;">
                <span>📷 رفع من جهازك</span>
                <input type="file" id="nc-file-upload" accept="image/*" style="display: none;" />
              </label>
            </div>
            <div id="nc-preview-box" style="margin-top: 8px; display: none; align-items: center; gap: 10px;">
              <img id="nc-preview-img" src="" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1;" />
              <span style="font-size: 12px; color: #16a34a; font-weight: 600;">✓ تم رفع صورة القسم بنجاح</span>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-full" style="padding: 12px; font-weight: 700;">إنشاء القسم وحفظه</button>
        </form>
      `);

      const ncFileInput = document.getElementById('nc-file-upload') as HTMLInputElement;
      if (ncFileInput) {
        ncFileInput.onchange = async () => {
          const file = ncFileInput.files?.[0];
          if (!file) return;
          try {
            showToast('جاري رفع صورة القسم مجاناً...', 'info');
            const res = await uploadImageFile(file);
            (document.getElementById('nc-img') as HTMLInputElement).value = res.url;
            const pBox = document.getElementById('nc-preview-box');
            const pImg = document.getElementById('nc-preview-img') as HTMLImageElement;
            if (pBox && pImg) {
              pImg.src = res.url;
              pBox.style.display = 'flex';
            }
            showToast('تم رفع صورة القسم بنجاح!', 'success');
          } catch (err: any) {
            showToast(err.message, 'error');
          }
        };
      }

      const form = document.getElementById('new-cat-form');
      if (form) {
        form.onsubmit = async (ev) => {
          ev.preventDefault();
          const name = (document.getElementById('nc-name-en') as HTMLInputElement).value;
          const nameAr = (document.getElementById('nc-name-ar') as HTMLInputElement).value;
          const slug = (document.getElementById('nc-slug') as HTMLInputElement).value;
          const img = (document.getElementById('nc-img') as HTMLInputElement).value;

          try {
            await addDoc(collection(db, 'categories'), {
              name,
              nameAr,
              slug,
              imageUrl: img,
              sortOrder: 10,
              isActive: true,
              createdAt: new Date().toISOString()
            });
            closeModal();
            showToast('تم إنشاء القسم بنجاح!', 'success');
            refreshAdminSection(section);
          } catch (err: any) {
            showToast(err.message, 'error');
          }
        };
      }
    };
  }

  // Edit category
  document.querySelectorAll('.admin-edit-cat-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      if (!id) return;
      const snap = await getDoc(doc(db, 'categories', id));
      if (!snap.exists()) return;
      const cat: any = snap.data();
      openModal(`
        <h3 style="font-size:20px;font-weight:700;margin-bottom:16px;">تعديل القسم</h3>
        <form id="edit-cat-form" style="display:flex;flex-direction:column;gap:var(--space-md);">
          <input id="ec-name-ar" class="form-input" required value="${cat.nameAr || ''}" placeholder="اسم القسم بالعربية" />
          <input id="ec-name-en" class="form-input" required value="${cat.name || ''}" placeholder="اسم القسم بالإنجليزية" />
          <input id="ec-slug" class="form-input" required value="${cat.slug || ''}" placeholder="Slug" />
          <div class="form-group">
            <label class="form-label" for="ec-img">صورة القسم</label>
            <input id="ec-img" class="form-input" required value="${cat.imageUrl || ''}" placeholder="ارفع صورة من جهازك أو الصق رابط الصورة" />
            <label class="btn btn-secondary btn-sm" style="cursor:pointer;display:inline-flex;margin-top:8px;">رفع صورة من الجهاز<input type="file" accept="image/*" data-image-upload-for="ec-img" data-image-preview="ec-img-preview" style="display:none;" /></label>
            <img id="ec-img-preview" src="${cat.imageUrl || ''}" alt="معاينة صورة القسم" style="display:block;width:88px;height:88px;object-fit:cover;border-radius:6px;margin-top:8px;" />
          </div>
          <input id="ec-sort" type="number" class="form-input" value="${cat.sortOrder || 1}" placeholder="ترتيب العرض" />
          <label class="form-label"><input id="ec-active" type="checkbox" ${cat.isActive !== false ? 'checked' : ''} /> ظاهر في المتجر</label>
          <button type="submit" class="btn btn-primary btn-full">حفظ التعديلات</button>
        </form>`);
      bindImageUploadControls(document);
      const form = document.getElementById('edit-cat-form');
      if (form) form.onsubmit = async (ev) => {
        ev.preventDefault();
        await updateDoc(doc(db, 'categories', id), {
          nameAr: (document.getElementById('ec-name-ar') as HTMLInputElement).value.trim(),
          name: (document.getElementById('ec-name-en') as HTMLInputElement).value.trim(),
          slug: (document.getElementById('ec-slug') as HTMLInputElement).value.trim(),
          imageUrl: (document.getElementById('ec-img') as HTMLInputElement).value.trim(),
          sortOrder: Number((document.getElementById('ec-sort') as HTMLInputElement).value) || 1,
          isActive: (document.getElementById('ec-active') as HTMLInputElement).checked,
          updatedAt: new Date().toISOString()
        });
        closeModal();
        showToast('تم تعديل القسم بنجاح', 'success');
        refreshAdminSection(section);
      };
    });
  });
  // Delete category
  document.querySelectorAll('.admin-del-cat-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      if (id && confirm('هل تريد حذف هذا القسم؟')) {
        try {
          await deleteDoc(doc(db, 'categories', id));
          showToast('تم حذف القسم', 'info');
          refreshAdminSection(section);
        } catch (err: any) {
          showToast(err.message, 'error');
        }
      }
    });
  });

  // Manage Order Drawer
  document.querySelectorAll('.open-order-details-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      if (!id) return;

      try {
        const orderResponse = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`);
        const orderResult = await orderResponse.json();
        if (!orderResponse.ok || !orderResult.success || !orderResult.order) {
          throw new Error(orderResult.message || 'تعذر تحميل تفاصيل الطلب');
        }
        const ord = orderResult.order;

        openModal(`
          <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">تفاصيل الطلب • ${ord.orderNumber}</h3>
          <p style="font-size: 13px; color: #64748b; margin-bottom: 16px;">العميل: ${ord.customerName} (${ord.customerPhone})</p>

          <div style="background: #f8fafc; padding: 12px; border-radius: 4px; font-size: 13px; margin-bottom: 16px;">
            <div><strong>عنوان التوصيل:</strong> ${ord.shippingAddress?.city || ''}، ${ord.shippingAddress?.address || ''}</div>
            <div><strong>طريقة الدفع:</strong> ${ord.paymentMethod === 'cod' ? 'الدفع عند الاستلام' : (ord.paymentMethod === 'vodafone_cash' ? 'فودافون كاش' : (ord.paymentMethod?.toUpperCase() || 'إلكتروني'))} (${ord.paymentStatus})</div>
            <div><strong>الإجمالي:</strong> ${state.formatPrice(ord.total)}</div>
          </div>

          <details style="margin-bottom:14px;">
            <summary style="cursor:pointer;font-weight:700;">تعديل بيانات العميل وعنوان التوصيل</summary>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
              <div class="form-group"><label class="form-label">اسم العميل</label><input id="adm-customer-name" class="form-input" value="${ord.customerName || ''}" /></div>
              <div class="form-group"><label class="form-label">رقم الهاتف</label><input id="adm-customer-phone" class="form-input" value="${ord.customerPhone || ''}" /></div>
              <div class="form-group"><label class="form-label">البريد الإلكتروني</label><input id="adm-customer-email" type="email" class="form-input" value="${ord.customerEmail || ''}" /></div>
              <div class="form-group"><label class="form-label">المحافظة</label><input id="adm-customer-governorate" class="form-input" value="${ord.shippingAddress?.governorate || ''}" /></div>
              <div class="form-group"><label class="form-label">المدينة / المنطقة</label><input id="adm-customer-city" class="form-input" value="${ord.shippingAddress?.city || ''}" /></div>
              <div class="form-group"><label class="form-label">العنوان بالتفصيل</label><input id="adm-customer-address" class="form-input" value="${ord.shippingAddress?.address || ''}" /></div>
              <div class="form-group"><label class="form-label">رقم المبنى / علامة مميزة</label><input id="adm-customer-building" class="form-input" value="${ord.shippingAddress?.building || ord.shippingAddress?.buildingDetails || ''}" /></div>
            </div>
          </details>

          <form id="update-order-status-form" style="display: flex; flex-direction: column; gap: 12px;">
            <div class="form-group">
              <label class="form-label">تحديث حالة دورة حياة الطلب</label>
              <select id="adm-order-status" class="form-select">
                <option value="new" ${ord.status === 'new' ? 'selected' : ''}>طلب جديد (بانتظار الاعتماد)</option>
                <option value="confirmed" ${ord.status === 'confirmed' ? 'selected' : ''}>مؤكد</option>
                <option value="processing" ${ord.status === 'processing' ? 'selected' : ''}>قيد التجهيز والتفصيل بالأتليه</option>
                <option value="shipped" ${ord.status === 'shipped' ? 'selected' : ''}>تم الشحن (مع شركة الشحن الجوي)</option>
                <option value="delivered" ${ord.status === 'delivered' ? 'selected' : ''}>تم التوصيل للعميل</option>
                <option value="cancelled" ${ord.status === 'cancelled' ? 'selected' : ''}>ملغي (إعادة القطع للمخزون تلقائياً)</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">رقم بوليصة الشحن والتتبع (DHL / FedEx / أرامكس)</label>
              <input type="text" id="adm-tracking-no" class="form-input" value="${ord.trackingNumber || ''}" placeholder="مثال: DHL-EXP-9928172" />
            </div>

            <div class="form-group">
              <label class="form-label">ملاحظات إدارية داخلية للأتليه</label>
              <input type="text" id="adm-order-note" class="form-input" placeholder="مثال: تم التأكيد مع العميل هاتفياً وتجهيز التغليف الفاخر" />
            </div>

            <div style="display: flex; gap: 8px;">
              <button type="submit" class="btn btn-primary" style="flex: 1; padding: 12px; font-weight: 700;">حفظ وتحديث الحالة</button>
              <button type="button" class="btn btn-secondary" onclick="window.print();">🖨 طباعة الفاتورة</button>
            </div>
          </form>
        `);

        const form = document.getElementById('update-order-status-form');
        if (form) {
          form.onsubmit = async (ev) => {
            ev.preventDefault();
            const newStatus = (document.getElementById('adm-order-status') as HTMLSelectElement).value;
            const tracking = (document.getElementById('adm-tracking-no') as HTMLInputElement).value;
            const note = (document.getElementById('adm-order-note') as HTMLInputElement).value;

            try {
              const res = await fetch('/api/orders/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  orderId: id,
                  newStatus,
                  trackingNumber: tracking,
                  note,
                  customerName: (document.getElementById('adm-customer-name') as HTMLInputElement).value,
                  customerPhone: (document.getElementById('adm-customer-phone') as HTMLInputElement).value,
                  customerEmail: (document.getElementById('adm-customer-email') as HTMLInputElement).value,
                  shippingAddress: {
                    ...(ord.shippingAddress || {}),
                    governorate: (document.getElementById('adm-customer-governorate') as HTMLInputElement).value,
                    city: (document.getElementById('adm-customer-city') as HTMLInputElement).value,
                    address: (document.getElementById('adm-customer-address') as HTMLInputElement).value,
                    building: (document.getElementById('adm-customer-building') as HTMLInputElement).value
                  },
                  adminEmail: state.getUser()?.email || 'admin'
                })
              });
              const resData = await res.json();
              if (resData.success) {
                invalidateAdminCache();
                closeModal();
                showToast('تم تحديث حالة الطلب بنجاح ومزامنة المخزون!', 'success');
                refreshAdminSection(section);
              } else {
                showToast(resData.message, 'error');
              }
            } catch (err: any) {
              showToast(err.message, 'error');
            }
          };
        }
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    });
  });

  if (section === 'pages') {
    const addPageButton = document.getElementById('admin-add-page-btn');
    const openPageEditor = (page: any = {}) => {
      openModal(`
        <h3 style="font-size:20px;font-weight:700;margin-bottom:16px;">${page.id ? 'تعديل صفحة' : 'إضافة صفحة جديدة'}</h3>
        <form id="admin-page-form" style="display:flex;flex-direction:column;gap:var(--space-md);">
          <div class="form-group"><label class="form-label">الرابط المختصر (slug)</label><input id="ap-slug" class="form-input" required value="${page.slug || ''}" placeholder="shipping-policy" /></div>
          <div class="form-group"><label class="form-label">العنوان بالعربية</label><input id="ap-title-ar" class="form-input" required value="${page.titleAr || ''}" /></div>
          <div class="form-group"><label class="form-label">العنوان بالإنجليزية</label><input id="ap-title-en" class="form-input" required value="${page.title || ''}" /></div>
          <div class="form-group"><label class="form-label">المحتوى بالعربية</label><textarea id="ap-content-ar" class="form-textarea" rows="6">${page.contentAr || ''}</textarea></div>
          <div class="form-group"><label class="form-label">المحتوى بالإنجليزية</label><textarea id="ap-content-en" class="form-textarea" rows="6">${page.content || ''}</textarea></div>
          <label><input type="checkbox" id="ap-published" ${page.isPublished !== false ? 'checked' : ''} /> نشر الصفحة</label>
          <button type="submit" class="btn btn-primary btn-full">حفظ الصفحة</button>
        </form>
      `);
      const form = document.getElementById('admin-page-form');
      if (form) form.onsubmit = async (event) => {
        event.preventDefault();
        const payload = {
          slug: (document.getElementById('ap-slug') as HTMLInputElement).value.trim().toLowerCase().replace(/\s+/g, '-'),
          titleAr: (document.getElementById('ap-title-ar') as HTMLInputElement).value.trim(),
          title: (document.getElementById('ap-title-en') as HTMLInputElement).value.trim(),
          contentAr: (document.getElementById('ap-content-ar') as HTMLTextAreaElement).value.trim(),
          content: (document.getElementById('ap-content-en') as HTMLTextAreaElement).value.trim(),
          isPublished: (document.getElementById('ap-published') as HTMLInputElement).checked,
          updatedAt: new Date().toISOString()
        };
        try {
          if (page.id) await updateDoc(doc(db, 'pages', page.id), payload);
          else await addDoc(collection(db, 'pages'), { ...payload, createdAt: new Date().toISOString() });
          invalidateAdminCache();
          closeModal();
          showToast('تم حفظ الصفحة بنجاح', 'success');
          refreshAdminSection(section);
        } catch (error: any) { showToast(error.message, 'error'); }
      };
    };
    if (addPageButton) addPageButton.onclick = () => openPageEditor();
    document.querySelectorAll('.admin-edit-page-btn').forEach(button => {
      button.addEventListener('click', async (event) => {
        const id = (event.currentTarget as HTMLElement).getAttribute('data-id');
        if (!id) return;
        try {
          const snap = await getDoc(doc(db, 'pages', id));
          if (!snap.exists()) throw new Error('لم يتم العثور على الصفحة');
          openPageEditor({ id, ...snap.data() });
        } catch (error: any) { showToast(error.message, 'error'); }
      });
    });
    document.querySelectorAll('.admin-delete-page-btn').forEach(button => {
      button.addEventListener('click', async (event) => {
        const id = (event.currentTarget as HTMLElement).getAttribute('data-id');
        if (!id || !confirm('هل تريد حذف هذه الصفحة نهائياً؟')) return;
        try {
          await deleteDoc(doc(db, 'pages', id));
          invalidateAdminCache();
          showToast('تم حذف الصفحة', 'success');
          refreshAdminSection(section);
        } catch (error: any) { showToast(error.message, 'error'); }
      });
    });
  }

  // Settings form submission with Free Hero image upload
  const settingsForm = document.getElementById('admin-settings-form');
  if (settingsForm) {
    const heroUpload = document.getElementById('set-hero-file-upload') as HTMLInputElement;
    if (heroUpload) {
      heroUpload.onchange = async () => {
        const file = heroUpload.files?.[0];
        if (!file) return;
        try {
          showToast('جاري رفع صورة البانر من جهازك مجاناً...', 'info');
          const res = await uploadImageFile(file);
          (document.getElementById('set-hero-img') as HTMLInputElement).value = res.url;
          const pImg = document.getElementById('set-hero-preview-img') as HTMLImageElement;
          if (pImg) pImg.src = res.url;
          showToast('تم رفع صورة البانر بنجاح!', 'success');
        } catch (err: any) {
          showToast(err.message, 'error');
        }
      };
    }

    const heroMobileUpload = document.getElementById('set-hero-mobile-file-upload') as HTMLInputElement;
    if (heroMobileUpload) {
      heroMobileUpload.onchange = async () => {
        const file = heroMobileUpload.files?.[0];
        if (!file) return;
        try {
          showToast('جاري رفع صورة الهاتف...', 'info');
          const res = await uploadImageFile(file);
          (document.getElementById('set-hero-mobile-img') as HTMLInputElement).value = res.url;
          const preview = document.getElementById('set-hero-mobile-preview-img') as HTMLImageElement;
          if (preview) preview.src = res.url;
          showToast('تم رفع صورة الهاتف بنجاح', 'success');
        } catch (err: any) {
          showToast(err.message, 'error');
        }
      };
    }

    settingsForm.onsubmit = async (e) => {
      e.preventDefault();
      const brandEn = (document.getElementById('set-brand-en') as HTMLInputElement).value;
      const brandAr = (document.getElementById('set-brand-ar') as HTMLInputElement).value;
      const heroEn = (document.getElementById('set-hero-title-en') as HTMLInputElement).value;
      const heroAr = (document.getElementById('set-hero-title-ar') as HTMLInputElement).value;
      const heroImg = (document.getElementById('set-hero-img') as HTMLInputElement).value;
      const heroMobileImg = (document.getElementById('set-hero-mobile-img') as HTMLInputElement).value;
      const heroSubtitleEn = (document.getElementById('set-hero-subtitle-en') as HTMLTextAreaElement).value;
      const heroSubtitleAr = (document.getElementById('set-hero-subtitle-ar') as HTMLTextAreaElement).value;
      const heroCtaEn = (document.getElementById('set-hero-cta-en') as HTMLInputElement).value;
      const heroCtaAr = (document.getElementById('set-hero-cta-ar') as HTMLInputElement).value;
      const annActive = (document.getElementById('set-ann-active') as HTMLInputElement).checked;
      const contactEmail = (document.getElementById('set-email') as HTMLInputElement).value;
      const contactPhone = (document.getElementById('set-phone') as HTMLInputElement).value;
      const address = (document.getElementById('set-address') as HTMLInputElement).value;
      const annEn = (document.getElementById('set-ann-en') as HTMLInputElement).value;
      const annAr = (document.getElementById('set-ann-ar') as HTMLInputElement).value;
      const freeShip = parseFloat((document.getElementById('set-free-ship') as HTMLInputElement).value);
      const whatsapp = (document.getElementById('set-whatsapp') as HTMLInputElement).value;
      const tax = parseFloat((document.getElementById('set-tax') as HTMLInputElement).value);
      const siteContent: Record<string, string> = {};
      Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-cms-key]')).forEach((field) => {
        const key = field.dataset.cmsKey;
        if (key) siteContent[key] = field.value;
      });
      const homeVisibility: Record<string, boolean> = {};
      document.querySelectorAll<HTMLInputElement>('[data-home-visibility]').forEach((field) => {
        const key = field.dataset.homeVisibility;
        if (key) homeVisibility[key] = field.checked;
      });

      try {
        const payload = {
          brandName: brandEn,
          brandNameAr: brandAr,
          tagline: (document.getElementById('set-tagline-en') as HTMLInputElement).value.trim(),
          taglineAr: (document.getElementById('set-tagline-ar') as HTMLInputElement).value.trim(),
          heroTitle: heroEn,
          heroTitleAr: heroAr,
          heroImageUrl: heroImg,
          heroImageMobileUrl: heroMobileImg,
          heroSubtitle: heroSubtitleEn,
          heroSubtitleAr: heroSubtitleAr,
          heroCtaText: heroCtaEn,
          heroCtaTextAr: heroCtaAr,
          heroCtaLink: (document.getElementById('set-hero-cta-link') as HTMLInputElement).value,
          heroCtaSecondaryText: (document.getElementById('set-hero-cta2-en') as HTMLInputElement).value,
          heroCtaSecondaryTextAr: (document.getElementById('set-hero-cta2-ar') as HTMLInputElement).value,
          heroCtaSecondaryLink: (document.getElementById('set-hero-cta2-link') as HTMLInputElement).value,
          heroTagline: (document.getElementById('set-hero-tagline-en') as HTMLInputElement).value,
          heroTaglineAr: (document.getElementById('set-hero-tagline-ar') as HTMLInputElement).value,
          heroTaglineActive: homeVisibility['hero.tagline'] !== false,
          heroTitleActive: homeVisibility['hero.title'] !== false,
          heroSubtitleActive: homeVisibility['hero.subtitle'] !== false,
          heroCtaPrimaryActive: homeVisibility['hero.primaryCta'] !== false,
          heroCtaSecondaryActive: homeVisibility['hero.secondaryCta'] !== false,
          heroOverlayActive: homeVisibility['hero.overlay'] !== false,
          announcementBarBgColor: (document.getElementById('set-ann-color') as HTMLInputElement).value,
          headerLogoUrl: (document.getElementById('set-header-logo') as HTMLInputElement).value,
          footerLogoUrl: (document.getElementById('set-footer-logo') as HTMLInputElement).value,
          announcementBarActive: annActive,
          contactEmail,
          contactPhone,
          address,
          announcementBarText: annEn,
          announcementBarTextAr: annAr,
          freeShippingThreshold: freeShip,
          whatsappNumber: whatsapp,
          taxPercentage: tax,
          enableTax: (document.getElementById('set-tax-active') as HTMLInputElement).checked,
          defaultShippingCost: Number((document.getElementById('set-default-shipping') as HTMLInputElement).value) || 0,
          currency: (document.getElementById('set-currency') as HTMLInputElement).value.trim() || 'EGP',
          currencyAr: (document.getElementById('set-currency-ar') as HTMLInputElement).value.trim() || 'ج.م',
          socialInstagram: (document.getElementById('set-social-instagram') as HTMLInputElement).value,
          socialFacebook: (document.getElementById('set-social-facebook') as HTMLInputElement).value,
          socialTiktok: (document.getElementById('set-social-tiktok') as HTMLInputElement).value,
          siteContent,
          homeVisibility,
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'settings', 'store'), payload, { merge: true });
        invalidateAdminCache();
        state.setSettings(payload);
        showToast('تم حفظ وتحديث إعدادات المتجر في فايربيز بنجاح!', 'success');
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    };
  }

  // Create Coupon Modal
  const addCoupBtn = document.getElementById('admin-add-coupon-btn');
  if (addCoupBtn) {
    addCoupBtn.onclick = () => {
      openModal(`
        <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">إنشاء كوبون خصم ترويجي جديد</h3>
        <form id="new-coup-form" style="display: flex; flex-direction: column; gap: var(--space-md);">
          <div class="form-group">
            <label class="form-label">رمز الكوبون *</label>
            <input type="text" id="ncp-code" required class="form-input" placeholder="مثال: LUXE20" style="text-transform: uppercase;" />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);">
            <div class="form-group">
              <label class="form-label">نوع الخصم *</label>
              <select id="ncp-type" class="form-select">
                <option value="percentage">نسبة مئوية (%)</option>
                <option value="fixed">مبلغ مالي ثابت (ج.م)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">قيمة الخصم *</label>
              <input type="number" id="ncp-val" required class="form-input" placeholder="100" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">الحد الأدنى لقيمة الطلب لتطبيق الكوبون (ج.م)</label>
            <input type="number" id="ncp-min" class="form-input" value="600" />
          </div>
          <button type="submit" class="btn btn-primary btn-full" style="padding: 12px; font-weight: 700;">حفظ وتفعيل الكوبون</button>
        </form>
      `);

      const form = document.getElementById('new-coup-form');
      if (form) {
        form.onsubmit = async (ev) => {
          ev.preventDefault();
          const code = (document.getElementById('ncp-code') as HTMLInputElement).value.trim().toUpperCase();
          const discountType = (document.getElementById('ncp-type') as HTMLSelectElement).value;
          const discountValue = parseFloat((document.getElementById('ncp-val') as HTMLInputElement).value);
          const minOrderValue = parseFloat((document.getElementById('ncp-min') as HTMLInputElement).value) || 0;

          try {
            await addDoc(collection(db, 'coupons'), {
              code,
              discountType,
              discountValue,
              minOrderValue,
              isActive: true,
              usageCount: 0,
              createdAt: new Date().toISOString()
            });
            closeModal();
            showToast('تم إنشاء الكوبون بنجاح!', 'success');
            refreshAdminSection(section);
          } catch (err: any) {
            showToast(err.message, 'error');
          }
        };
      }
    };
  }

  // Toggle coupon
  document.querySelectorAll('.admin-edit-coupon-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, 'coupons', id));
        if (!snap.exists()) throw new Error('لم يتم العثور على الكوبون');
        const coupon = snap.data();
        openModal(`
          <h3 style="font-size:20px;font-weight:700;margin-bottom:16px;">تعديل الكوبون ${coupon.code}</h3>
          <form id="edit-coupon-form" style="display:flex;flex-direction:column;gap:var(--space-md);">
            <div class="form-group"><label class="form-label">رمز الكوبون</label><input id="ecp-code" class="form-input" value="${coupon.code || ''}" required /></div>
            <div class="form-group"><label class="form-label">نوع الخصم</label><select id="ecp-type" class="form-select"><option value="percentage" ${coupon.discountType === 'percentage' ? 'selected' : ''}>نسبة مئوية</option><option value="fixed" ${coupon.discountType === 'fixed' ? 'selected' : ''}>مبلغ ثابت</option></select></div>
            <div class="form-group"><label class="form-label">قيمة الخصم</label><input type="number" id="ecp-value" class="form-input" value="${coupon.discountValue || 0}" min="0" required /></div>
            <div class="form-group"><label class="form-label">الحد الأدنى للطلب (ج.م)</label><input type="number" id="ecp-min" class="form-input" value="${coupon.minOrderValue || 0}" min="0" /></div>
            <div class="form-group"><label class="form-label">حد مرات الاستخدام</label><input type="number" id="ecp-limit" class="form-input" value="${coupon.usageLimit || ''}" min="0" placeholder="اتركه فارغاً بلا حد" /></div>
            <label><input type="checkbox" id="ecp-active" ${coupon.isActive ? 'checked' : ''} /> الكوبون مفعل</label>
            <button type="submit" class="btn btn-primary btn-full">حفظ التعديلات</button>
          </form>
        `);
        const form = document.getElementById('edit-coupon-form');
        if (form) form.onsubmit = async (submitEvent) => {
          submitEvent.preventDefault();
          try {
            const usageLimitValue = (document.getElementById('ecp-limit') as HTMLInputElement).value;
            await updateDoc(doc(db, 'coupons', id), {
              code: (document.getElementById('ecp-code') as HTMLInputElement).value.trim().toUpperCase(),
              discountType: (document.getElementById('ecp-type') as HTMLSelectElement).value,
              discountValue: Number((document.getElementById('ecp-value') as HTMLInputElement).value),
              minOrderValue: Number((document.getElementById('ecp-min') as HTMLInputElement).value) || 0,
              usageLimit: usageLimitValue ? Number(usageLimitValue) : null,
              isActive: (document.getElementById('ecp-active') as HTMLInputElement).checked,
              updatedAt: new Date().toISOString()
            });
            invalidateAdminCache();
            closeModal();
            showToast('تم تحديث بيانات الكوبون بنجاح', 'success');
            refreshAdminSection(section);
          } catch (error: any) { showToast(error.message, 'error'); }
        };
      } catch (error: any) { showToast(error.message, 'error'); }
    });
  });

  // Toggle coupon
  document.querySelectorAll('.admin-toggle-coupon-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      const isActive = (e.currentTarget as HTMLElement).getAttribute('data-active') === 'true';
      if (!id) return;
      try {
        await updateDoc(doc(db, 'coupons', id), { isActive: !isActive });
        showToast(isActive ? 'تم تعطيل الكوبون' : 'تم تفعيل الكوبون', 'info');
        refreshAdminSection(section);
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    });
  });

  document.querySelectorAll('.admin-del-coupon-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      if (id && confirm('هل تريد حذف هذا الكوبون نهائيًا؟')) {
        await deleteDoc(doc(db, 'coupons', id));
        showToast('تم حذف الكوبون', 'info');
        refreshAdminSection(section);
      }
    });
  });
  // Process Return Modal
  document.querySelectorAll('.admin-process-return-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, 'returns', id));
        if (!snap.exists()) return;
        const ret = snap.data();

        openModal(`
          <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">معالجة طلب الإرجاع • طلب ${ret.orderNumber}</h3>
          <p style="font-size: 13px; color: #64748b; margin-bottom: 16px;">السبب: ${ret.reason} (${ret.type === 'exchange' ? 'استبدال' : 'استرجاع'})</p>

          <form id="proc-ret-form" style="display: flex; flex-direction: column; gap: var(--space-md);">
            <div class="form-group">
              <label class="form-label">قرار الفحص وحالة المرتجع</label>
              <select id="pr-status" class="form-select">
                <option value="approved">معتمد (بانتظار شحن القطعة من العميل)</option>
                <option value="received">تم استلام القطعة في الأتليه وفحصها</option>
                <option value="refunded">تم رد المبلغ / إرسال المقاس البديل</option>
                <option value="rejected">مرفوض (تلف القطعة أو إزالة التاج)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">ملاحظات الأتليه الداخلية</label>
              <input type="text" id="pr-notes" class="form-input" placeholder="مثال: القطعة بحالة ممتازة وبها كافة بطاقات العلامة" />
            </div>
            <button type="submit" class="btn btn-primary btn-full" style="padding: 12px; font-weight: 700;">تحديث حالة طلب الإرجاع</button>
          </form>
        `);

        const form = document.getElementById('proc-ret-form');
        if (form) {
          form.onsubmit = async (ev) => {
            ev.preventDefault();
            const status = (document.getElementById('pr-status') as HTMLSelectElement).value;
            const notes = (document.getElementById('pr-notes') as HTMLInputElement).value;

            try {
              await updateDoc(doc(db, 'returns', id), {
                status,
                adminNotes: notes,
                updatedAt: new Date().toISOString()
              });
              closeModal();
              showToast('تم تحديث حالة طلب الإرجاع!', 'success');
              refreshAdminSection(section);
            } catch (err: any) {
              showToast(err.message, 'error');
            }
          };
        }
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    });
  });

  // Manual Stock Adjustment Modal
  const adjustStockBtn = document.getElementById('admin-adjust-stock-btn');
  if (adjustStockBtn) {
    adjustStockBtn.onclick = () => {
      openModal(`
        <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">تعديل المخزون يدوياً</h3>
        <form id="stock-adj-form" style="display: flex; flex-direction: column; gap: var(--space-md);">
          <div class="form-group">
            <label class="form-label">اختر القطعة وكود SKU *</label>
            <select id="adj-sku-select" class="form-select">
              <option value="LET-TC-001-CAM-S">معطف ترنش الأتليه (رملي • S)</option>
              <option value="LET-TC-001-CAM-M">معطف ترنش الأتليه (رملي • M)</option>
              <option value="LET-DR-002-CHP-S">فستان الحرير الملكي (شمبانيا • S)</option>
              <option value="LET-DR-002-CHP-M">فستان الحرير الملكي (شمبانيا • M)</option>
              <option value="LET-BZ-003-IVR-M">بليزر الصوف المنحوت (عاجي • M)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">تغيير الكمية (مثال: +10 أو -2) *</label>
            <input type="number" id="adj-delta" required class="form-input" placeholder="مثال: 5" />
          </div>
          <div class="form-group">
            <label class="form-label">سبب التعديل المخزني *</label>
            <input type="text" id="adj-reason" required class="form-input" placeholder="مثال: توريد دفعة جديدة من ورشة الخياطة" />
          </div>
          <button type="submit" class="btn btn-primary btn-full" style="padding: 12px; font-weight: 700;">تسجيل الحركة وتحديث المخزون</button>
        </form>
      `);

      const form = document.getElementById('stock-adj-form');
      if (form) {
        form.onsubmit = async (ev) => {
          ev.preventDefault();
          const sku = (document.getElementById('adj-sku-select') as HTMLSelectElement).value;
          const delta = parseInt((document.getElementById('adj-delta') as HTMLInputElement).value);
          const reason = (document.getElementById('adj-reason') as HTMLInputElement).value;

          try {
            await addDoc(collection(db, 'inventoryMovements'), {
              sku,
              quantityDelta: delta,
              type: 'manual_adjustment',
              reason,
              performedBy: state.getUser()?.email || 'admin',
              createdAt: new Date().toISOString()
            });
            closeModal();
            showToast(`تم تسجيل حركة المخزون (${delta > 0 ? '+' : ''}${delta}) في فايربيز!`, 'success');
            refreshAdminSection(section);
          } catch (err: any) {
            showToast(err.message, 'error');
          }
        };
      }
    };
  }
}
