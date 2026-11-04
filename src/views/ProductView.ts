import { state, showToast, openModal, closeModal } from '../state';
import { doc, getDoc, collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { renderProductCard } from './HomeView';

export async function renderProductView(productId: string): Promise<string> {
  const lang = state.getLang();
  
  if (!productId) {
    return `<div class="container" style="padding: 100px 0; text-align: center;"><h3>Product not found</h3><a href="#shop" class="btn btn-primary" style="margin-top: 16px;">Back to Shop</a></div>`;
  }

  let product: any = null;
  let relatedProducts: any[] = [];
  let bestSellerProducts: any[] = [];
  let reviews: any[] = [];

  try {
    const pSnap = await getDoc(doc(db, 'products', productId));
    if (pSnap.exists()) {
      product = { id: pSnap.id, ...pSnap.data() };
      
      // Load recommendation candidates once, then build both shelves locally.
      const [productsSnap, revSnap] = await Promise.all([
        getDocs(query(collection(db, 'products'), where('isPublished', '==', true))),
        getDocs(query(collection(db, 'reviews'), where('productId', '==', productId)))
      ]);
      const candidates: any[] = productsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.id !== productId);
      relatedProducts = candidates
        .filter(p => product.categoryId && p.categoryId === product.categoryId)
        .slice(0, 4);
      bestSellerProducts = candidates.filter(p => p.isBestSeller).slice(0, 4);
      if (bestSellerProducts.length === 0) bestSellerProducts = candidates.slice(0, 4);
      reviews = revSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (e) {
    console.error('Error fetching product details', e);
  }

  if (!product) {
    return `
      <div class="container" style="padding: 80px 0; text-align: center;">
        <h3 style="font-family: var(--font-editorial); font-size: 32px; margin-bottom: 16px;">${lang === 'ar' ? 'المنتج غير موجود' : 'Product Not Found'}</h3>
        <a href="#shop" class="btn btn-primary">${state.t('continueShopping')}</a>
      </div>
    `;
  }

  const title = lang === 'ar' ? (product.nameAr || product.name) : product.name;
  const description = lang === 'ar' ? (product.descriptionAr || product.description) : product.description;
  const isSale = product.salePrice && product.salePrice > 0;
  const price = isSale ? product.salePrice : product.price;
  const originalPrice = isSale ? product.price : null;
  const images = (product.images && product.images.length > 0) ? product.images : ['https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=1000&q=85'];
  const variants = product.variants || [];
  const colors = product.colors || [];
  const sizes = product.sizes || [];

  // Default selection
  const defaultColor = colors.length > 0 ? (colors[0].name || colors[0]) : '';
  const defaultSize = sizes.length > 0 ? sizes[0] : '';
  const defaultVariant = variants.find((v: any) => v.color === defaultColor && v.size === defaultSize) || variants[0];
  const initialStock = defaultVariant ? defaultVariant.stock : (product.totalStock || 10);

  // Review calculations
  const avgRating = reviews.length > 0 
    ? (reviews.reduce((sum, r) => sum + (r.rating || 5), 0) / reviews.length).toFixed(1)
    : '5.0';

  return `
    <div class="product-page container animate-fade-in" style="padding-top: var(--space-xl); padding-bottom: var(--space-4xl);" data-prod-id="${product.id}">
      
      <!-- Breadcrumb -->
      <div style="font-size: 12px; color: var(--color-text-subtle); margin-bottom: var(--space-xl);">
        <a href="#home">${state.t('home')}</a> / 
        <a href="#shop">${state.t('shop')}</a> / 
        <a href="#shop?cat=${product.categoryId}">${product.categoryName || 'Couture'}</a> / 
        <span style="color: var(--color-text-main); font-weight: 500;">${title}</span>
      </div>

      <!-- Main Product Presentation -->
      <div class="product-details-grid">
        
        <!-- Left: Image Gallery & Zoom -->
        <div>
          <div class="zoom-container" style="aspect-ratio: 3/4; background: var(--color-surface-muted); border-radius: var(--radius-xs); border: 1px solid var(--color-border); margin-bottom: var(--space-md);">
            <img id="main-product-image" src="${images[0]}" alt="${title}" class="zoom-image" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>

          <!-- Thumbnails -->
          ${images.length > 1 ? `
            <div style="display: flex; gap: var(--space-sm); overflow-x: auto; padding-bottom: 6px;">
              ${images.map((img: string, idx: number) => `
                <img 
                  src="${img}" 
                  alt=""
                  class="product-thumb ${idx === 0 ? 'active' : ''}" 
                  style="width: 80px; height: 100px; object-fit: cover; cursor: pointer; border-radius: var(--radius-xs); border: 2px solid ${idx === 0 ? 'var(--color-brand)' : 'transparent'}; opacity: ${idx === 0 ? '1' : '0.7'}; transition: all 0.2s;"
                  onerror="this.style.display='none'"
                  onclick="
                    document.getElementById('main-product-image').src = '${img}';
                    document.querySelectorAll('.product-thumb').forEach(el => { el.style.borderColor='transparent'; el.style.opacity='0.7'; });
                    this.style.borderColor='var(--color-brand)';
                    this.style.opacity='1';
                  "
                />
              `).join('')}
            </div>
          ` : ''}
        </div>

        <!-- Right: Purchasing Controls & Details -->
        <div>
          <span style="font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--color-brand-gold); display: block; margin-bottom: 4px;">
            ${product.categoryName || 'Atelier Collection'} • SKU: <span id="display-sku">${defaultVariant ? defaultVariant.sku : product.sku}</span>
          </span>

          <h1 style="font-family: var(--font-editorial); font-size: clamp(28px, 3.5vw, 40px); font-weight: 500; line-height: 1.2; margin-bottom: var(--space-sm);">
            ${title}
          </h1>

          <!-- Reviews Star Summary -->
          <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: var(--space-md);">
            <div style="color: var(--color-brand-gold); display: flex;">
              ★★★★★
            </div>
            <span style="font-weight: 600;">${avgRating}</span>
            <span style="color: var(--color-text-subtle);">(${reviews.length} ${state.t('reviews')})</span>
          </div>

          <!-- Pricing -->
          <div style="display: flex; align-items: baseline; gap: var(--space-md); margin-bottom: var(--space-lg); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-lg);">
            <span style="font-size: 26px; font-weight: 600; color: var(--color-brand); font-family: var(--font-editorial);">
              ${state.formatPrice(price)}
            </span>
            ${originalPrice ? `
              <span style="font-size: 18px; color: var(--color-text-subtle); text-decoration: line-through;">
                ${state.formatPrice(originalPrice)}
              </span>
              <span class="product-badge sale" style="position: static; font-size: 11px;">
                ${lang === 'ar' ? 'وفر ' : 'Save '}${state.formatPrice(originalPrice - price)}
              </span>
            ` : ''}
          </div>

          <!-- Description Excerpt -->
          <p style="font-size: 14px; line-height: 1.7; color: var(--color-text-muted); margin-bottom: var(--space-xl);">
            ${description}
          </p>

          <!-- Color Selector -->
          ${colors.length > 0 ? `
            <div style="margin-bottom: var(--space-lg);">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">
                <span>${state.t('color')}: <strong id="selected-color-label">${lang === 'ar' ? (colors[0].nameAr || colors[0].name) : colors[0].name}</strong></span>
              </div>
              <div style="display: flex; gap: var(--space-sm);">
                ${colors.map((c: any, idx: number) => `
                  <button 
                    type="button"
                    class="color-select-btn ${idx === 0 ? 'selected' : ''}" 
                    data-color="${c.name}"
                    data-color-ar="${c.nameAr || c.name}"
                    style="width: 32px; height: 32px; border-radius: 50%; background-color: ${c.hex}; border: 2px solid ${idx === 0 ? 'var(--color-brand)' : 'transparent'}; box-shadow: 0 0 0 1px #d1cfc7; cursor: pointer; transition: all 0.2s;"
                    title="${lang === 'ar' ? (c.nameAr || c.name) : c.name}"
                  ></button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Size Selector & Size Guide Link -->
          <div style="margin-bottom: var(--space-xl);">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">
              <span>${state.t('size')}</span>
              <button id="open-size-guide-btn" type="button" style="text-decoration: underline; color: var(--color-brand-gold); cursor: pointer; font-size: 11px;">
                ${state.t('sizeGuide')} <i class="fa-solid fa-ruler-combined" aria-hidden="true"></i>
              </button>
            </div>
            <div class="product-size-options" style="display: flex; gap: var(--space-xs); flex-wrap: wrap;">
              ${sizes.map((s: string, idx: number) => `
                <button 
                  type="button"
                  class="size-select-btn ${idx === 0 ? 'selected' : ''}" 
                  data-size="${s}"
                  style="min-width: 44px; height: 44px; padding: 0 12px; border: 1px solid ${idx === 0 ? 'var(--color-brand)' : 'var(--color-border)'}; background: ${idx === 0 ? 'var(--color-brand)' : '#ffffff'}; color: ${idx === 0 ? '#ffffff' : 'var(--color-text-main)'}; font-size: 13px; font-weight: 600; border-radius: var(--radius-xs); cursor: pointer; transition: all 0.2s;"
                >
                  ${s}
                </button>
              `).join('')}
            </div>

            <!-- Stock Availability Badge for Selected Variant -->
            <div id="variant-stock-notice" style="margin-top: 10px; font-size: 12px; display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${initialStock > 0 ? '#22c55e' : '#ef4444'};"></span>
              <span id="stock-text" style="color: ${initialStock > 0 ? 'var(--color-text-main)' : 'var(--color-danger)'}; font-weight: 500;">
                ${initialStock > 0 ? (initialStock <= 5 ? (lang === 'ar' ? `متبقي ${initialStock} قطع فقط في المخزون!` : `Only ${initialStock} pieces left!`) : state.t('inStock')) : state.t('outOfStock')}
              </span>
            </div>
          </div>

          <!-- Quantity & Add to Cart Actions -->
          <div class="product-purchase-actions" style="display: flex; gap: var(--space-md); margin-bottom: var(--space-xl); align-items: center;">
            <!-- Stepper -->
            <div style="display: flex; align-items: center; border: 1px solid var(--color-border); border-radius: var(--radius-xs); background: #ffffff;">
              <button id="qty-dec-btn" type="button" style="padding: 12px 16px; font-size: 16px;">-</button>
              <input id="selected-quantity-input" type="number" value="1" min="1" max="${initialStock || 1}" readonly style="width: 44px; text-align: center; border: none; font-weight: 600; font-size: 14px;" />
              <button id="qty-inc-btn" type="button" style="padding: 12px 16px; font-size: 16px;">+</button>
            </div>

            <!-- Add to Cart Button -->
            <button id="add-to-bag-btn" class="btn btn-primary btn-lg add-to-bag-btn" style="flex: 1;" ${initialStock <= 0 ? 'disabled' : ''}>
              ${initialStock > 0 ? state.t('addToBag') : state.t('outOfStock')}
            </button>

            <!-- Wishlist Button -->
            <button id="toggle-wishlist-btn" class="icon-btn" style="width: 50px; height: 50px; border: 1px solid var(--color-border);" title="${state.t('wishlist')}">
              <i class="fa-solid fa-heart" aria-hidden="true" style="font-size: 22px;"></i>
            </button>
          </div>

          <!-- Product Details Tabs: Fabric & Care -->
          <div style="border-top: 1px solid var(--color-border); padding-top: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-md); font-size: 13px;">
            ${product.fabric ? `
              <div>
                <h4 style="font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-size: 12px; margin-bottom: 4px;">
                  <i class="fa-solid fa-star" aria-hidden="true"></i> ${lang === 'ar' ? 'الخامة والتكوين' : 'Fabric & Composition'}
                </h4>
                <p style="color: var(--color-text-muted); line-height: 1.6;">${product.fabric}</p>
              </div>
            ` : ''}

            ${product.careInstructions ? `
              <div>
                <h4 style="font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-size: 12px; margin-bottom: 4px;">
                  <i class="fa-solid fa-star" aria-hidden="true"></i> ${state.t('fabricCare')}
                </h4>
                <p style="color: var(--color-text-muted); line-height: 1.6;">${product.careInstructions}</p>
              </div>
            ` : ''}

            <div>
              <h4 style="font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-size: 12px; margin-bottom: 4px;">
                <i class="fa-solid fa-star" aria-hidden="true"></i> ${lang === 'ar' ? 'التوصيل والضمان' : 'Complimentary White-Glove Delivery'}
              </h4>
              <p style="color: var(--color-text-muted); line-height: 1.6;">
                ${lang === 'ar' 
                  ? 'يصلكم في صندوق الهدايا الأيقوني مع كيس حفظ الملابس وشهادة الأصالة. إرجاع مجاني خلال 14 يوماً.' 
                  : 'Delivered in keepsake gift box with garment cover and certificate of authenticity. 14-day complimentary returns.'}
              </p>
            </div>
          </div>

        </div>

      </div>

      <!-- Product Recommendations -->
      <section class="product-recommendations" aria-label="${lang === 'ar' ? 'ترشيحات المنتجات' : 'Product recommendations'}">
        ${bestSellerProducts.length > 0 ? `
          <div class="recommendation-shelf">
            <div class="recommendation-heading">
              <div>
                <span class="recommendation-eyebrow">${lang === 'ar' ? 'اختيارات العملاء' : 'Client Favorites'}</span>
                <h3>${lang === 'ar' ? 'الأكثر مبيعًا' : 'Best Sellers'}</h3>
              </div>
              <a href="#shop?filter=bestseller" class="recommendation-link">${lang === 'ar' ? 'عرض الكل ←' : 'View all →'}</a>
            </div>
            <div class="grid-products recommendation-grid">
              ${bestSellerProducts.map(p => renderProductCard(p, lang)).join('')}
            </div>
          </div>
        ` : ''}
        ${relatedProducts.length > 0 ? `
          <div class="recommendation-shelf">
            <div class="recommendation-heading">
              <div>
                <span class="recommendation-eyebrow">${lang === 'ar' ? 'اختيارات من نفس المجموعة' : 'From The Same Collection'}</span>
                <h3>${lang === 'ar' ? 'منتجات متعلقة' : 'Related Products'}</h3>
              </div>
              <a href="#shop?cat=${product.categoryId || ''}" class="recommendation-link">${lang === 'ar' ? 'استكشف المجموعة ←' : 'Explore collection →'}</a>
            </div>
            <div class="grid-products recommendation-grid">
              ${relatedProducts.map(p => renderProductCard(p, lang)).join('')}
            </div>
          </div>
        ` : ''}
      </section>

      <!-- Customer Reviews Section -->
      <section style="margin-top: var(--space-4xl); border-top: 1px solid var(--color-border); padding-top: var(--space-3xl);">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: var(--space-2xl); flex-wrap: wrap; gap: var(--space-md);">
          <div>
            <h3 style="font-family: var(--font-editorial); font-size: 28px; font-weight: 500;">
              ${state.t('reviews')}
            </h3>
            <p style="font-size: 14px; color: var(--color-text-muted);">
              ${avgRating} / 5.0 • ${lang === 'ar' ? 'تقييمات موثقة من عملاء المتجر' : 'Verified Client Reviews'}
            </p>
          </div>
          
          <button id="open-write-review-btn" class="btn btn-secondary btn-sm">
            <i class="fa-solid fa-star" aria-hidden="true"></i> ${state.t('writeReview')}
          </button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-lg);">
          ${reviews.length === 0 ? `
            <div style="padding: var(--space-xl); background: var(--color-surface); border: 1px dashed var(--color-border); border-radius: var(--radius-xs); text-align: center; color: var(--color-text-subtle);">
              ${lang === 'ar' ? 'كن أول من يكتب تقييماً لهذه القطعة الراقية.' : 'Be the first to review this atelier garment.'}
            </div>
          ` : reviews.map(rev => `
            <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xs); padding: var(--space-lg);">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-weight: 600; font-size: 14px;">${rev.customerName}</span>
                <span style="color: var(--color-brand-gold);">★★★★★</span>
              </div>
              <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 6px; color: var(--color-text-main);">${rev.title || ''}</h4>
              <p style="font-size: 13px; color: var(--color-text-muted); line-height: 1.6;">${rev.comment}</p>
              ${rev.isVerifiedPurchase ? `
                <span style="display: inline-block; font-size: 11px; color: var(--color-success); margin-top: 10px; font-weight: 500;">
                  ✓ ${lang === 'ar' ? 'عملية شراء مؤكدة' : 'Verified Atelier Purchase'}
                </span>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </section>

    </div>
  `;
}

export function setupProductEvents(productData: any) {
  if (!productData) return;
  const lang = state.getLang();
  let selectedColor = productData.colors && productData.colors.length > 0 ? productData.colors[0].name : '';
  let selectedSize = productData.sizes && productData.sizes.length > 0 ? productData.sizes[0] : '';
  let currentStock = getVariantStock(selectedColor, selectedSize);

  function getVariantStock(color: string, size: string): number {
    const variants = productData.variants || [];
    const v = variants.find((item: any) => 
      (!color || item.color === color) && (!size || item.size === size)
    );
    return v ? v.stock : (productData.totalStock || 10);
  }

  function getVariantSku(color: string, size: string): string {
    const variants = productData.variants || [];
    const v = variants.find((item: any) => 
      (!color || item.color === color) && (!size || item.size === size)
    );
    return v ? v.sku : (productData.sku || '');
  }

  function updateStockDisplay() {
    currentStock = getVariantStock(selectedColor, selectedSize);
    const sku = getVariantSku(selectedColor, selectedSize);
    
    const skuEl = document.getElementById('display-sku');
    if (skuEl) skuEl.textContent = sku;

    const stockText = document.getElementById('stock-text');
    const addBtn = document.getElementById('add-to-bag-btn') as HTMLButtonElement;
    const qtyInput = document.getElementById('selected-quantity-input') as HTMLInputElement;

    if (stockText) {
      if (currentStock <= 0) {
        stockText.textContent = state.t('outOfStock');
        stockText.style.color = 'var(--color-danger)';
        if (addBtn) {
          addBtn.disabled = true;
          addBtn.textContent = state.t('outOfStock');
        }
      } else {
        stockText.textContent = currentStock <= 5 
          ? (lang === 'ar' ? `متبقي ${currentStock} قطع فقط في المخزون!` : `Only ${currentStock} pieces left in stock!`)
          : state.t('inStock');
        stockText.style.color = 'var(--color-text-main)';
        if (addBtn) {
          addBtn.disabled = false;
          addBtn.textContent = state.t('addToBag');
        }
      }
    }

    if (qtyInput) {
      qtyInput.max = String(Math.max(1, currentStock));
      if (parseInt(qtyInput.value) > currentStock) {
        qtyInput.value = String(Math.max(1, currentStock));
      }
    }
  }

  // Color Swatches
  document.querySelectorAll('.color-select-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.color-select-btn').forEach(b => {
        (b as HTMLElement).style.borderColor = 'transparent';
      });
      const target = e.currentTarget as HTMLElement;
      target.style.borderColor = 'var(--color-brand)';
      selectedColor = target.getAttribute('data-color') || '';
      const colorAr = target.getAttribute('data-color-ar') || selectedColor;
      const label = document.getElementById('selected-color-label');
      if (label) label.textContent = lang === 'ar' ? colorAr : selectedColor;
      updateStockDisplay();
    });
  });

  // Size Buttons
  document.querySelectorAll('.size-select-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.size-select-btn').forEach(b => {
        (b as HTMLElement).style.background = '#ffffff';
        (b as HTMLElement).style.color = 'var(--color-text-main)';
        (b as HTMLElement).style.borderColor = 'var(--color-border)';
      });
      const target = e.currentTarget as HTMLElement;
      target.style.background = 'var(--color-brand)';
      target.style.color = '#ffffff';
      target.style.borderColor = 'var(--color-brand)';
      selectedSize = target.getAttribute('data-size') || '';
      updateStockDisplay();
    });
  });

  // Quantity Steppers
  const qtyInput = document.getElementById('selected-quantity-input') as HTMLInputElement;
  const incBtn = document.getElementById('qty-inc-btn');
  const decBtn = document.getElementById('qty-dec-btn');

  if (incBtn && qtyInput) {
    incBtn.onclick = () => {
      let val = parseInt(qtyInput.value) || 1;
      if (val < currentStock) {
        qtyInput.value = String(val + 1);
      } else {
        showToast(lang === 'ar' ? `الحد الأقصى المتاح بالمخزون هو ${currentStock}` : `Maximum available quantity is ${currentStock}`, 'warning');
      }
    };
  }
  if (decBtn && qtyInput) {
    decBtn.onclick = () => {
      let val = parseInt(qtyInput.value) || 1;
      if (val > 1) {
        qtyInput.value = String(val - 1);
      }
    };
  }

  // Add to Bag
  const addBtn = document.getElementById('add-to-bag-btn');
  if (addBtn) {
    addBtn.onclick = () => {
      if (currentStock <= 0) return;
      const qty = parseInt(qtyInput?.value || '1');
      const isSale = productData.salePrice && productData.salePrice > 0;
      const finalPrice = isSale ? productData.salePrice : productData.price;
      const sku = getVariantSku(selectedColor, selectedSize);

      state.addToCart({
        productId: productData.id,
        variantSku: sku,
        name: productData.name,
        nameAr: productData.nameAr,
        price: finalPrice,
        quantity: qty,
        color: selectedColor,
        size: selectedSize,
        image: (productData.images && productData.images[0]) || '',
        maxStock: currentStock
      });

      // Automatically open cart drawer to provide direct feedback!
      const drawer = document.getElementById('cart-drawer');
      if (drawer) drawer.classList.add('open');
    };
  }

  // Wishlist toggle
  const wishBtn = document.getElementById('toggle-wishlist-btn');
  if (wishBtn) {
    wishBtn.onclick = () => {
      state.toggleWishlist(productData.id);
      const heart = wishBtn.querySelector('.fa-heart');
      if (heart) heart.classList.toggle('is-active', state.getWishlist().includes(productData.id));
    };
  }

  // Size Guide Modal
  const sizeGuideBtn = document.getElementById('open-size-guide-btn');
  if (sizeGuideBtn) {
    sizeGuideBtn.onclick = () => {
      openModal(`
        <h3 style="font-family: var(--font-editorial); font-size: 24px; margin-bottom: 8px;">
          ${state.t('sizeGuide')} (Atelier Measurement Standards)
        </h3>
        <p style="font-size: 13px; color: var(--color-text-muted); margin-bottom: 20px;">
          ${lang === 'ar' ? 'القياسات بالسنتيمتر (cm) للمحيط الحقيقي للجسم.' : 'Measurements in centimeters (cm) corresponding to body proportions.'}
        </p>

        <div class="size-guide-table-scroll"><table style="width: 100%; min-width: 620px; border-collapse: collapse; font-size: 13px; text-align: center; margin-bottom: 20px;">
          <thead>
            <tr style="background: var(--color-surface-muted); border-bottom: 1px solid var(--color-border);">
              <th style="padding: 10px;">Size</th>
              <th style="padding: 10px;">FR / IT</th>
              <th style="padding: 10px;">Bust (cm)</th>
              <th style="padding: 10px;">Waist (cm)</th>
              <th style="padding: 10px;">Hips (cm)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid var(--color-border-subtle);"><td style="padding: 8px; font-weight: 600;">XS</td><td>34 / 38</td><td>80 - 84</td><td>60 - 64</td><td>86 - 90</td></tr>
            <tr style="border-bottom: 1px solid var(--color-border-subtle);"><td style="padding: 8px; font-weight: 600;">S</td><td>36 / 40</td><td>84 - 88</td><td>64 - 68</td><td>90 - 94</td></tr>
            <tr style="border-bottom: 1px solid var(--color-border-subtle);"><td style="padding: 8px; font-weight: 600;">M</td><td>38 / 42</td><td>88 - 92</td><td>68 - 72</td><td>94 - 98</td></tr>
            <tr style="border-bottom: 1px solid var(--color-border-subtle);"><td style="padding: 8px; font-weight: 600;">L</td><td>40 / 44</td><td>92 - 96</td><td>72 - 76</td><td>98 - 102</td></tr>
            <tr><td style="padding: 8px; font-weight: 600;">XL</td><td>42 / 46</td><td>96 - 102</td><td>76 - 82</td><td>102 - 108</td></tr>
          </tbody>
        </table></div>

        <button class="btn btn-primary btn-sm btn-full" onclick="document.getElementById('global-modal').classList.remove('open');">
          ${lang === 'ar' ? 'فهمت المقاس' : 'Close Size Guide'}
        </button>
      `);
    };
  }

  // Write Review Modal
  const writeReviewBtn = document.getElementById('open-write-review-btn');
  if (writeReviewBtn) {
    writeReviewBtn.onclick = () => {
      openModal(`
        <h3 style="font-family: var(--font-editorial); font-size: 24px; margin-bottom: 12px;">
          ${state.t('writeReview')} • ${lang === 'ar' ? (productData.nameAr || productData.name) : productData.name}
        </h3>
        <form id="submit-review-form" style="display: flex; flex-direction: column; gap: var(--space-md);">
          <div class="form-group">
            <label class="form-label">${state.t('fullName')} *</label>
            <input type="text" id="rev-name" required class="form-input" placeholder="e.g. Charlotte Dubois" />
          </div>
          <div class="form-group">
            <label class="form-label">${state.t('email')} *</label>
            <input type="email" id="rev-email" required class="form-input" placeholder="e.g. charlotte@example.com" />
          </div>
          <div class="form-group">
            <label class="form-label">${lang === 'ar' ? 'التقييم (النجوم)' : 'Rating'} *</label>
            <select id="rev-rating" class="form-select">
              <option value="5">★★★★★ 5 Stars (Exceptional)</option>
              <option value="4">★★★★☆ 4 Stars (Very Good)</option>
              <option value="3">★★★☆☆ 3 Stars (Average)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">${lang === 'ar' ? 'عنوان التقييم' : 'Review Headline'}</label>
            <input type="text" id="rev-title" class="form-input" placeholder="e.g. Perfect fit and drape" />
          </div>
          <div class="form-group">
            <label class="form-label">${lang === 'ar' ? 'تفاصيل تجربتك' : 'Review Details'} *</label>
            <textarea id="rev-comment" required rows="4" class="form-textarea" placeholder="${lang === 'ar' ? 'اكتبي رأيك في القماش والقصة...' : 'Share your impressions on the fabric, silhouette, and craft...'}"></textarea>
          </div>
          <button type="submit" class="btn btn-primary btn-full">
            ${lang === 'ar' ? 'إرسال التقييم للنشر' : 'Submit Review'}
          </button>
        </form>
      `);

      const form = document.getElementById('submit-review-form');
      if (form) {
        form.onsubmit = async (ev) => {
          ev.preventDefault();
          const name = (document.getElementById('rev-name') as HTMLInputElement).value;
          const email = (document.getElementById('rev-email') as HTMLInputElement).value;
          const rating = parseInt((document.getElementById('rev-rating') as HTMLSelectElement).value);
          const revTitle = (document.getElementById('rev-title') as HTMLInputElement).value;
          const comment = (document.getElementById('rev-comment') as HTMLTextAreaElement).value;

          try {
            await addDoc(collection(db, 'reviews'), {
              productId: productData.id,
              customerName: name,
              customerEmail: email,
              rating,
              title: revTitle,
              comment,
              isApproved: true,
              isVerifiedPurchase: true,
              createdAt: new Date().toISOString()
            });

            closeModal();
            showToast(lang === 'ar' ? 'شكراً لك! تم تسجيل تقييمك بنجاح.' : 'Thank you! Your review has been submitted.', 'success');
            // Refresh view
            window.location.hash = `product?id=${productData.id}&reload=${Date.now()}`;
          } catch (err: any) {
            showToast(err.message, 'error');
          }
        };
      }
    };
  }
}
