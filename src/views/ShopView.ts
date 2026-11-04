import { state } from '../state';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { renderProductCard } from './HomeView';

export async function renderShopView(urlParams: URLSearchParams): Promise<string> {
  const lang = state.getLang();
  const selectedCat = urlParams.get('cat') || '';
  const filterType = urlParams.get('filter') || '';
  const searchQuery = urlParams.get('q') || '';

  let products: any[] = [];
  let categories: any[] = [];

  try {
    const pSnap = await getDocs(query(collection(db, 'products'), where('isPublished', '==', true)));
    products = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const cSnap = await getDocs(query(collection(db, 'categories'), where('isActive', '==', true)));
    categories = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('Error fetching shop products', e);
  }

  // Filter products based on URL params initially
  let filtered = [...products];

  if (selectedCat) {
    filtered = filtered.filter(p => p.categoryId === selectedCat);
  }
  if (filterType === 'new') {
    filtered = filtered.filter(p => p.isNewArrival);
  }
  if (filterType === 'bestseller') {
    filtered = filtered.filter(p => p.isBestSeller);
  }
  if (searchQuery) {
    const qLower = searchQuery.toLowerCase();
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(qLower) || 
      (p.nameAr && p.nameAr.includes(qLower)) ||
      (p.description && p.description.toLowerCase().includes(qLower))
    );
  }

  return `
    <div class="shop-page container animate-fade-in" style="padding-top: var(--space-2xl); padding-bottom: var(--space-4xl);">
      
      <!-- Breadcrumb & Header -->
      <div style="margin-bottom: var(--space-2xl); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-xl);">
        <div style="font-size: 12px; color: var(--color-text-subtle); margin-bottom: 8px;">
          <a href="#home">${state.t('home')}</a> / <span>${state.t('shop')}</span>
          ${selectedCat ? ` / <strong>${categories.find(c => c.id === selectedCat)?.name || ''}</strong>` : ''}
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: var(--space-md);">
          <div>
            <h1 style="font-family: var(--font-editorial); font-size: clamp(28px, 4vw, 42px); font-weight: 500;">
              ${state.t('allProducts')}
            </h1>
            <p style="font-size: 14px; color: var(--color-text-muted);">
              ${lang === 'ar' ? `عرض ${filtered.length} قطعة من الأزياء الفاخرة` : `Displaying ${filtered.length} bespoke couture pieces`}
            </p>
          </div>

          <!-- Search Bar -->
          <div style="display: flex; align-items: center; border: 1px solid var(--color-border); border-radius: var(--radius-xs); background: #ffffff; padding: 4px 12px; width: 300px; max-width: 100%;">
            <i class="fa-solid fa-magnifying-glass" aria-hidden="true" style="font-size: 18px;"></i>
            <input 
              type="text" 
              id="shop-search-input" 
              placeholder="${state.t('searchPlaceholder')}" 
              value="${searchQuery}" 
              style="border: none; outline: none; padding: 8px; width: 100%; font-size: 13px;" 
            />
          </div>
        </div>
      </div>

      <!-- Mobile Category Chips (Horizontal Scrollable on mobile) -->
      <div class="mobile-category-chips-bar">
        <a href="#shop" class="mobile-chip ${!selectedCat && !filterType ? 'active' : ''}">
          ${lang === 'ar' ? 'الكل' : 'All'} (${products.length})
        </a>
        <a href="#shop?filter=new" class="mobile-chip ${filterType === 'new' ? 'active' : ''}">
          <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> ${state.t('newArrivals')}
        </a>
        <a href="#shop?filter=bestseller" class="mobile-chip ${filterType === 'bestseller' ? 'active' : ''}">
          <i class="fa-solid fa-fire" aria-hidden="true"></i> ${state.t('bestSellers')}
        </a>
        ${categories.map(c => `
          <a href="#shop?cat=${c.id}" class="mobile-chip ${selectedCat === c.id ? 'active' : ''}">
            ${lang === 'ar' ? (c.nameAr || c.name) : c.name}
          </a>
        `).join('')}
      </div>

      <!-- Main Layout: Filters Sidebar + Products Grid -->
      <div class="shop-grid-layout">
        
        <!-- Filters Sidebar -->
        <aside class="shop-filters-sidebar">
          
          <!-- Category Filter -->
          <div style="margin-bottom: var(--space-xl);">
            <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: var(--space-md); border-bottom: 1px solid var(--color-border); padding-bottom: 6px;">
              ${lang === 'ar' ? 'التصنيفات' : 'Categories'}
            </h3>
            <ul style="list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
              <li>
                <a href="#shop" style="display: flex; justify-content: space-between; color: ${!selectedCat ? 'var(--color-brand)' : 'var(--color-text-muted)'}; font-weight: ${!selectedCat ? '600' : '400'};">
                  <span>${lang === 'ar' ? 'كافة القطع' : 'All Collections'}</span>
                  <span>(${products.length})</span>
                </a>
              </li>
              ${categories.map(c => `
                <li>
                  <a href="#shop?cat=${c.id}" style="display: flex; justify-content: space-between; color: ${selectedCat === c.id ? 'var(--color-brand)' : 'var(--color-text-muted)'}; font-weight: ${selectedCat === c.id ? '600' : '400'};">
                    <span>${lang === 'ar' ? (c.nameAr || c.name) : c.name}</span>
                    <span>(${products.filter(p => p.categoryId === c.id).length})</span>
                  </a>
                </li>
              `).join('')}
            </ul>
          </div>

          <!-- Quick Filters: New & Best Sellers -->
          <div style="margin-bottom: var(--space-xl);">
            <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: var(--space-md); border-bottom: 1px solid var(--color-border); padding-bottom: 6px;">
              ${lang === 'ar' ? 'المجموعات الخاصة' : 'Editions'}
            </h3>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
              <a href="#shop?filter=new" style="color: ${filterType === 'new' ? 'var(--color-brand)' : 'var(--color-text-muted)'}; font-weight: ${filterType === 'new' ? '600' : '400'};">
                <i class="fa-solid fa-star" aria-hidden="true"></i> ${state.t('newArrivals')}
              </a>
              <a href="#shop?filter=bestseller" style="color: ${filterType === 'bestseller' ? 'var(--color-brand)' : 'var(--color-text-muted)'}; font-weight: ${filterType === 'bestseller' ? '600' : '400'};">
                <i class="fa-solid fa-star" aria-hidden="true"></i> ${state.t('bestSellers')}
              </a>
            </div>
          </div>

          <!-- Price Sorter Dropdown -->
          <div style="margin-bottom: var(--space-xl);">
            <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: var(--space-md); border-bottom: 1px solid var(--color-border); padding-bottom: 6px;">
              ${state.t('sortBy')}
            </h3>
            <select id="shop-sort-select" class="form-select" style="font-size: 13px;">
              <option value="newest">${state.t('sortNewest')}</option>
              <option value="price-asc">${state.t('sortPriceAsc')}</option>
              <option value="price-desc">${state.t('sortPriceDesc')}</option>
              <option value="bestseller">${state.t('sortBestSeller')}</option>
            </select>
          </div>

          <!-- Reset Filters Button -->
          ${(selectedCat || filterType || searchQuery) ? `
            <a href="#shop" class="btn btn-secondary btn-sm btn-full" style="font-size: 11px;">
              ${lang === 'ar' ? 'إعادة ضبط كل الفلاتر ↺' : 'Reset All Filters ↺'}
            </a>
          ` : ''}

        </aside>

        <!-- Products Grid Container -->
        <div>
          ${filtered.length === 0 ? `
            <div style="text-align: center; padding: var(--space-4xl) 0; color: var(--color-text-muted); background: var(--color-surface); border: 1px dashed var(--color-border); border-radius: var(--radius-sm);">
              <i class="fa-solid fa-magnifying-glass" aria-hidden="true" style="font-size: 48px;"></i>
              <h3 style="font-size: 18px; color: var(--color-text-main); margin-bottom: 8px;">
                ${lang === 'ar' ? 'لم يتم العثور على قطع مطابقة' : 'No matching pieces found'}
              </h3>
              <p style="font-size: 13px; margin-bottom: var(--space-lg);">
                ${lang === 'ar' ? 'يرجى تجربة البحث بكلمات أخرى أو إزالة الفلاتر المحددة.' : 'Try adjusting your search criteria or removing active filters.'}
              </p>
              <a href="#shop" class="btn btn-primary btn-sm">
                ${state.t('allProducts')}
              </a>
            </div>
          ` : `
            <div id="shop-products-grid" class="grid-products">
              ${filtered.map(p => renderProductCard(p, lang)).join('')}
            </div>
          `}
        </div>

      </div>
    </div>
  `;
}

export function setupShopEvents() {
  const searchInput = document.getElementById('shop-search-input') as HTMLInputElement;
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = searchInput.value.trim();
        window.location.hash = val ? `shop?q=${encodeURIComponent(val)}` : 'shop';
      }
    });
  }

  const sortSelect = document.getElementById('shop-sort-select') as HTMLSelectElement;
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      const grid = document.getElementById('shop-products-grid');
      if (!grid) return;
      const cards = Array.from(grid.querySelectorAll('.product-card'));
      const sortVal = sortSelect.value;

      cards.sort((a, b) => {
        const priceA = parseFloat(a.querySelector('.price-current')?.textContent?.replace(/[^0-9.]/g, '') || '0');
        const priceB = parseFloat(b.querySelector('.price-current')?.textContent?.replace(/[^0-9.]/g, '') || '0');
        if (sortVal === 'price-asc') return priceA - priceB;
        if (sortVal === 'price-desc') return priceB - priceA;
        return 0;
      });

      cards.forEach(c => grid.appendChild(c));
    });
  }
}
