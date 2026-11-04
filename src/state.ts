/**
 * Global Reactive Store & State Management
 * Pure Vanilla JavaScript with Custom Event Subscriptions
 */

export interface CartItem {
  productId: string;
  variantSku: string;
  name: string;
  nameAr?: string;
  price: number;
  quantity: number;
  color: string;
  size: string;
  image: string;
  maxStock: number;
}

export interface StoreSettings {
  brandName: string;
  brandNameAr: string;
  tagline: string;
  taglineAr: string;
  currency: string;
  currencyAr: string;
  whatsappNumber: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  announcementBarText: string;
  announcementBarTextAr: string;
  announcementBarActive: boolean;
  announcementBarBgColor: string;
  taxPercentage: number;
  enableTax: boolean;
  freeShippingThreshold: number;
  defaultShippingCost: number;
  heroTitle: string;
  heroTitleAr: string;
  heroSubtitle: string;
  heroSubtitleAr: string;
  heroImageUrl: string;
  heroCtaText: string;
  heroCtaTextAr: string;
  heroCtaLink: string;
  headerLogoUrl?: string;
  footerLogoUrl?: string;
  heroImageMobileUrl?: string;
  heroCtaSecondaryText?: string;
  heroCtaSecondaryTextAr?: string;
  heroCtaSecondaryLink?: string;
  heroTagline?: string;
  heroTaglineAr?: string;
  heroTaglineActive?: boolean;
  heroTitleActive?: boolean;
  heroSubtitleActive?: boolean;
  heroCtaPrimaryActive?: boolean;
  heroCtaSecondaryActive?: boolean;
  heroOverlayActive?: boolean;
  siteContent?: Record<string, string>;
  homeVisibility?: Record<string, boolean>;
  socialInstagram: string;
  socialFacebook: string;
  socialTiktok: string;
}

const DEFAULT_SETTINGS: StoreSettings = {
  brandName: "EIGHTY-EIGHT",
  brandNameAr: "EIGHTY-EIGHT",
  tagline: "Contemporary Egyptian Fashion & Casual Luxury",
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
  announcementBarBgColor: "#15803d",
  taxPercentage: 0,
  enableTax: false,
  freeShippingThreshold: 1500,
  defaultShippingCost: 65,
  heroTitle: "EIGHTY-EIGHT",
  heroTitleAr: "EIGHTY-EIGHT • كولكشن الموسم الجديد",
  heroSubtitle: "Discover the Egyptian streetwear edition crafted from 100% premium Egyptian heavy cotton.",
  heroSubtitleAr: "كولكشن أزياء مصري عصري بخامات قطن مصري 100% ثقيل ومعالج، وتصميمات تجمع بين البساطة والفخامة اليومية.",
  heroImageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1800&q=85",
  heroCtaText: "Shop Collection",
  heroCtaTextAr: "استكشف الكولكشن الآن",
  heroCtaLink: "#shop",
  heroImageMobileUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=900&h=1200&q=85",
  heroCtaSecondaryText: "Explore Streetwear",
  heroCtaSecondaryTextAr: "اكتشف المجموعة",
  heroCtaSecondaryLink: "#shop",
  heroTagline: "Atelier Runway Edition • Autumn/Winter",
  heroTaglineAr: "المجموعة الحصرية • خريف وشتاء",
  heroTaglineActive: true,
  heroTitleActive: true,
  heroSubtitleActive: true,
  heroCtaPrimaryActive: true,
  heroCtaSecondaryActive: true,
  heroOverlayActive: true,
  siteContent: {},
  socialInstagram: "https://instagram.com/eightyeight_eg",
  socialFacebook: "https://facebook.com/eightyeight.eg",
  socialTiktok: "https://tiktok.com/@eightyeight.eg"
};

// UI Translations Dictionary - Professional Egyptian Tone
export const translations = {
  ar: {
    home: "الرئيسية",
    shop: "المتجر والمنتجات",
    collections: "الكولكشن والمجموعات",
    newArrivals: "وصل حديثاً",
    bestSellers: "الأكثر مبيعاً",
    about: "عن البراند",
    cart: "سلة المشتريات",
    checkout: "إتمام الطلب والدفع",
    account: "حسابي",
    trackOrder: "تتبع شحنتك",
    adminDashboard: "لوحة الإدارة",
    searchPlaceholder: "ابحث عن هوديز، تيشيرتات، كارجو، جواكيت...",
    addToBag: "أضف إلى السلة",
    addedToBag: "تمت الإضافة إلى السلة بنجاح",
    outOfStock: "نفد من المخزون",
    inStock: "متوفر وجاهز للشحن",
    selectSize: "اختر المقاس المناسب",
    selectColor: "اختر اللون",
    sizeGuide: "جدول المقاسات الدقيق",
    fabricCare: "تفاصيل الخامة وإرشادات الغسيل",
    reviews: "تقييمات وآراء العملاء",
    writeReview: "اكتب رأيك في المنتج",
    emptyCart: "سلة المشتريات فارغة حالياً",
    continueShopping: "متابعة التسوق",
    subtotal: "المجموع الفرعي",
    shipping: "مصاريف الشحن",
    freeShipping: "شحن مجاني",
    tax: "الضريبة",
    total: "الإجمالي النهائي",
    couponCode: "كوبون الخصم",
    applyCoupon: "تطبيق الكود",
    remove: "إزالة",
    itemCount: "قطع",
    orderSummary: "ملخص طلبك",
    shippingAddress: "عنوان التوصيل في مصر",
    fullName: "الاسم بالكامل",
    phone: "رقم الموبايل للتواصل والتوصيل",
    email: "البريد الإلكتروني",
    governorate: "المحافظة (القاهرة، الجيزة، الإسكندرية...)",
    city: "المنطقة / الحي (التجمع، الشيخ زايد، المعادي...)",
    streetAddress: "العنوان بالتفصيل واسم الشارع",
    buildingDetails: "رقم العمارة / الشقة أو علامة مميزة",
    paymentMethod: "طريقة الدفع",
    cod: "الدفع عند الاستلام كاش (Cash on Delivery)",
    creditCard: "بطاقة بنكية / فيزا أو ماستركارد أو ميزة",
    applePay: "محفظة إلكترونية (فودافون كاش / إنستاباي InstaPay)",
    placeOrder: "تأكيد الطلب وشحن الأوردر",
    orderConfirmed: "ألف مبروك! تم تسجيل وتأكيد طلبك بنجاح وجاري تجهيزه.",
    orderNumber: "رقم الأوردر",
    viewOrders: "طلباتي السابقة",
    printInvoice: "طباعة الفاتورة",
    login: "تسجيل الدخول",
    register: "إنشاء حساب جديد",
    logout: "تسجيل الخروج",
    adminLogin: "دخول الإدارة",
    allProducts: "جميع القطع والأزياء",
    filters: "تصفية المنتجات",
    priceRange: "نطاق السعر",
    sortBy: "ترتيب حسب",
    sortNewest: "الأحدث",
    sortPriceAsc: "السعر: من الأقل للأعلى",
    sortPriceDesc: "السعر: من الأعلى للأقل",
    sortBestSeller: "الأكثر مبيعاً",
    color: "اللون",
    size: "المقاس",
    quantity: "الكمية",
    stockAvailable: "الكمية المتاحة",
    wishlist: "المفضلة",
    freeShippingNotice: "شحن سريع مجاني للطلبات الأكثر من",
    returnsTitle: "الاستبدال والاسترجاع",
    requestReturn: "طلب استرجاع أو استبدال",
    reason: "سبب الإرجاع",
    status: "الحالة"
  },
  en: {
    home: "Home",
    shop: "Shop",
    collections: "Collections",
    newArrivals: "New Arrivals",
    bestSellers: "Best Sellers",
    about: "The Atelier",
    cart: "Shopping Bag",
    checkout: "Checkout",
    account: "Account",
    trackOrder: "Track Order",
    adminDashboard: "Admin Portal",
    searchPlaceholder: "Search couture coats, silk gowns, tailoring...",
    addToBag: "Add to Shopping Bag",
    addedToBag: "Added to Bag",
    outOfStock: "Sold Out",
    inStock: "In Stock",
    selectSize: "Please select a size",
    selectColor: "Please select a color",
    sizeGuide: "Size & Fit Guide",
    fabricCare: "Fabric & Garment Care",
    reviews: "Client Reviews",
    writeReview: "Write a Review",
    emptyCart: "Your shopping bag is currently empty",
    continueShopping: "Continue Browsing",
    subtotal: "Subtotal",
    shipping: "Shipping",
    freeShipping: "Complimentary Shipping",
    tax: "Estimated Tax",
    total: "Total",
    couponCode: "Promotional Code",
    applyCoupon: "Apply",
    remove: "Remove",
    itemCount: "items",
    orderSummary: "Order Summary",
    shippingAddress: "Shipping & Delivery Address",
    fullName: "Full Name",
    phone: "Phone Number",
    email: "Email Address",
    governorate: "State / Governorate",
    city: "City / District",
    streetAddress: "Street Address & Villa/Building",
    buildingDetails: "Apartment / Suite (Optional)",
    paymentMethod: "Payment Method",
    cod: "Cash on Delivery",
    creditCard: "Credit / Debit Card",
    applePay: "Apple Pay / Digital Wallet",
    placeOrder: "Complete Order",
    orderConfirmed: "Thank you! Your order has been placed.",
    orderNumber: "Order Number",
    viewOrders: "View My Orders",
    printInvoice: "Print Invoice",
    login: "Sign In",
    register: "Create Account",
    logout: "Sign Out",
    adminLogin: "Admin Login",
    allProducts: "All Garments & Accessories",
    filters: "Filter Products",
    priceRange: "Price Range",
    sortBy: "Sort By",
    sortNewest: "Newest Arrivals",
    sortPriceAsc: "Price: Low to High",
    sortPriceDesc: "Price: High to Low",
    sortBestSeller: "Most Coveted",
    color: "Color",
    size: "Size",
    quantity: "Quantity",
    stockAvailable: "Available Stock",
    wishlist: "Wishlist",
    freeShippingNotice: "Complimentary express delivery on orders over",
    returnsTitle: "Returns & Exchanges",
    requestReturn: "Request Return or Exchange",
    reason: "Return Reason",
    status: "Status"
  }
};

class StateManager {
  private lang: 'ar' | 'en' = 'ar';
  private theme: 'light' | 'dark' = 'light';
  private cart: CartItem[] = [];
  private wishlist: string[] = []; // product IDs
  private settings: StoreSettings = DEFAULT_SETTINGS;
  private currentUser: any = null;
  private isAdminUser: boolean = false;
  private appliedCoupon: { code: string; discount: number; type: string } | null = null;
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      const savedLang = localStorage.getItem('letoile_lang');
      if (savedLang === 'en' || savedLang === 'ar') {
        this.lang = savedLang;
      }
      const savedTheme = localStorage.getItem('letoile_theme');
      if (savedTheme === 'dark' || savedTheme === 'light') this.theme = savedTheme;
      this.updateHtmlDir();

      const savedCart = localStorage.getItem('letoile_cart');
      if (savedCart) {
        this.cart = JSON.parse(savedCart);
      }

      const savedWishlist = localStorage.getItem('letoile_wishlist');
      if (savedWishlist) {
        this.wishlist = JSON.parse(savedWishlist);
      }
    } catch (e) {
      console.error('Failed to load local state', e);
    }
  }

  private saveCart() {
    localStorage.setItem('letoile_cart', JSON.stringify(this.cart));
    this.notify();
  }

  private saveWishlist() {
    localStorage.setItem('letoile_wishlist', JSON.stringify(this.wishlist));
    this.notify();
  }

  private updateHtmlDir() {
    document.documentElement.lang = this.lang;
    document.documentElement.dir = this.lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset.theme = this.theme;
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  // Language
  public getLang(): 'ar' | 'en' {
    return this.lang;
  }

  public setLang(newLang: 'ar' | 'en') {
    this.lang = newLang;
    localStorage.setItem('letoile_lang', newLang);
    this.updateHtmlDir();
    this.notify();
  }

  public getTheme(): 'light' | 'dark' {
    return this.theme;
  }

  public setTheme(newTheme: 'light' | 'dark') {
    this.theme = newTheme;
    localStorage.setItem('letoile_theme', newTheme);
    this.updateHtmlDir();
    this.notify();
  }

  public t(key: keyof typeof translations.ar): string {
    return translations[this.lang][key] || key;
  }

  // Settings
  public getSettings(): StoreSettings {
    return this.settings;
  }

  public setSettings(newSettings: Partial<StoreSettings>) {
    this.settings = {
      ...this.settings,
      ...newSettings,
      siteContent: { ...(this.settings.siteContent || {}), ...(newSettings.siteContent || {}) }
    };
    this.notify();
  }

  public getSiteText(key: string, fallback: string): string {
    return this.settings.siteContent?.[key] ?? fallback;
  }

  // Price & Currency Formatter (Egyptian Pound EGP)
  public formatPrice(amount: number | string = 0): string {
    const num = Number(amount) || 0;
    const rounded = Math.round(num);
    const formatted = rounded.toLocaleString('en-US');
    if (this.lang === 'ar') {
      return `${formatted} ج.م`;
    }
    return `${formatted} EGP`;
  }

  // Cart Management
  public getCart(): CartItem[] {
    return this.cart;
  }

  public getCartCount(): number {
    return this.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  public getCartSubtotal(): number {
    return this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  public addToCart(item: CartItem) {
    const existingIndex = this.cart.findIndex(
      i => i.productId === item.productId && i.variantSku === item.variantSku
    );

    if (existingIndex > -1) {
      const existing = this.cart[existingIndex];
      const newQty = existing.quantity + item.quantity;
      if (item.maxStock && newQty > item.maxStock) {
        showToast(
          this.lang === 'ar' 
            ? `عذراً، أقصى كمية متاحة هي ${item.maxStock}`
            : `Only ${item.maxStock} pieces available in stock`,
          'warning'
        );
        existing.quantity = item.maxStock;
      } else {
        existing.quantity = newQty;
      }
    } else {
      this.cart.push(item);
    }

    this.saveCart();
    showToast(this.t('addedToBag'), 'success');
  }

  public updateCartQuantity(productId: string, variantSku: string, newQuantity: number) {
    if (newQuantity <= 0) {
      this.removeFromCart(productId, variantSku);
      return;
    }
    const item = this.cart.find(i => i.productId === productId && i.variantSku === variantSku);
    if (item) {
      if (item.maxStock && newQuantity > item.maxStock) {
        item.quantity = item.maxStock;
        showToast(
          this.lang === 'ar'
            ? `الكمية المتاحة بالمخزون هي ${item.maxStock} فقط`
            : `Maximum available stock is ${item.maxStock}`,
          'warning'
        );
      } else {
        item.quantity = newQuantity;
      }
      this.saveCart();
    }
  }

  public removeFromCart(productId: string, variantSku: string) {
    this.cart = this.cart.filter(
      i => !(i.productId === productId && i.variantSku === variantSku)
    );
    this.saveCart();
    showToast(this.lang === 'ar' ? 'تم حذف المنتج من السلة' : 'Item removed from cart', 'info');
  }

  public clearCart() {
    this.cart = [];
    this.appliedCoupon = null;
    this.saveCart();
  }

  // Coupon
  public getAppliedCoupon() {
    return this.appliedCoupon;
  }

  public setAppliedCoupon(coupon: { code: string; discount: number; type: string } | null) {
    this.appliedCoupon = coupon;
    this.notify();
  }

  // Wishlist
  public getWishlist(): string[] {
    return this.wishlist;
  }

  public toggleWishlist(productId: string) {
    if (this.wishlist.includes(productId)) {
      this.wishlist = this.wishlist.filter(id => id !== productId);
      showToast(this.lang === 'ar' ? 'تمت الإزالة من المفضلة' : 'Removed from wishlist', 'info');
    } else {
      this.wishlist.push(productId);
      showToast(this.lang === 'ar' ? 'تمت الإضافة للمفضلة' : 'Saved to wishlist', 'success');
    }
    this.saveWishlist();
  }

  // Auth & Admin State
  public setCurrentUser(user: any, isAdmin: boolean = false) {
    this.currentUser = user;
    if (isAdmin || (user && user.email?.toLowerCase() === 'muhammedadel.dev@gmail.com')) {
      this.isAdminUser = true;
      try {
        sessionStorage.setItem('eightyeight_admin_auth', 'true');
        sessionStorage.setItem('eightyeight_admin_user', JSON.stringify(user || { email: 'muhammedadel.dev@gmail.com' }));
      } catch {}
    } else if (user === null) {
      this.isAdminUser = false;
      try {
        sessionStorage.removeItem('eightyeight_admin_auth');
        sessionStorage.removeItem('eightyeight_admin_user');
      } catch {}
    } else {
      this.isAdminUser = false;
    }
    this.notify();
  }

  public getUser() {
    if (!this.currentUser) {
      try {
        const saved = sessionStorage.getItem('eightyeight_admin_user');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return this.currentUser;
  }

  public isAdmin(): boolean {
    if (this.isAdminUser) return true;
    if (this.currentUser && this.currentUser.email?.toLowerCase() === 'muhammedadel.dev@gmail.com') return true;
    try {
      if (sessionStorage.getItem('eightyeight_admin_auth') === 'true') return true;
    } catch {}
    return false;
  }
}

export const state = new StateManager();

// Toast Notifications System
export function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button style="color: rgba(255,255,255,0.7); font-size: 16px; margin-left: 8px;">&times;</button>
  `;

  toast.querySelector('button')!.onclick = () => {
    toast.remove();
  };

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

// Modal Management
export function openModal(contentHtml: string, onClose?: () => void) {
  let backdrop = document.getElementById('global-modal');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'global-modal';
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
  }

  backdrop.innerHTML = `
    <div class="modal-box">
      <div style="display: flex; justify-content: flex-end; margin-bottom: 8px;">
        <button id="modal-close-btn" class="modal-close-btn" aria-label="Close modal"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </div>
      <div id="modal-body-content">
        ${contentHtml}
      </div>
    </div>
  `;

  requestAnimationFrame(() => {
    backdrop!.classList.add('open');
  });

  const closeBtn = backdrop.querySelector('#modal-close-btn');
  const close = () => {
    backdrop!.classList.remove('open');
    if (onClose) onClose();
  };

  if (closeBtn) closeBtn.addEventListener('click', close);
  backdrop.onclick = (e) => {
    if (e.target === backdrop) close();
  };
}

export function closeModal() {
  const backdrop = document.getElementById('global-modal');
  if (backdrop) {
    backdrop.classList.remove('open');
  }
}
