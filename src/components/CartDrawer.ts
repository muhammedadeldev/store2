import { state, showToast } from '../state';

export function renderCartDrawer(): string {
  const lang = state.getLang();
  const cart = state.getCart();
  const subtotal = state.getCartSubtotal();
  const settings = state.getSettings();
  const freeThreshold = settings.freeShippingThreshold || 250;
  const remainingForFree = Math.max(0, freeThreshold - subtotal);
  const progressPercent = Math.min(100, Math.round((subtotal / freeThreshold) * 100));

  return `
    <div id="cart-drawer" class="cart-drawer">
      <div class="cart-drawer-header">
        <div style="display: flex; align-items: baseline; gap: 8px;">
          <h3 style="font-family: var(--font-editorial); font-size: 20px; text-transform: uppercase; letter-spacing: 0.05em;">
            ${state.t('cart')}
          </h3>
          <span style="font-size: 13px; color: var(--color-text-subtle);">(${state.getCartCount()} ${state.t('itemCount')})</span>
        </div>
        <button id="close-cart-drawer-btn" class="icon-btn" aria-label="Close">
          <i class="fa-solid fa-xmark" aria-hidden="true" style="font-size: 22px;"></i>
        </button>
      </div>

      <!-- Free Shipping Progress -->
      <div style="padding: 12px var(--space-lg); background-color: var(--color-surface-muted); border-bottom: 1px solid var(--color-border); font-size: 12px;">
        ${remainingForFree > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: 500;">
            <span>${lang === 'ar' ? `أضف ${state.formatPrice(remainingForFree)} إضافية للشحن المجاني!` : `Add ${state.formatPrice(remainingForFree)} more for Free Shipping!`}</span>
            <span>${progressPercent}%</span>
          </div>
          <div style="height: 4px; background: #e2ded5; border-radius: 2px; overflow: hidden;">
            <div style="width: ${progressPercent}%; height: 100%; background: var(--color-brand-gold); transition: width 0.3s ease;"></div>
          </div>
        ` : `
          <div style="color: var(--color-success); font-weight: 600; display: flex; align-items: center; gap: 6px;">
            <span>✓</span>
            <span>${lang === 'ar' ? 'أوردرك مؤهل للشحن المجاني لجميع المحافظات!' : 'Congratulations! Qualified for Free Shipping.'}</span>
          </div>
        `}
      </div>

      <!-- Cart Items List -->
      <div class="cart-drawer-body">
        ${cart.length === 0 ? `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; color: var(--color-text-subtle); padding: var(--space-xl) 0;">
            <i class="fa-solid fa-bag-shopping" aria-hidden="true" style="font-size: 48px;"></i>
            <p style="font-size: 16px; font-weight: 500; color: var(--color-text-main); margin-bottom: 8px;">
              ${state.t('emptyCart')}
            </p>
            <p style="font-size: 13px; max-width: 240px; margin-bottom: var(--space-lg);">
              ${lang === 'ar' ? 'استكشف كولكشن EIGHTY-EIGHT من الهوديز والتيشيرتات والملابس العصرية.' : 'Discover our latest hoodies, t-shirts, and streetwear essentials.'}
            </p>
            <a href="#shop" class="btn btn-secondary btn-sm" onclick="document.getElementById('cart-drawer').classList.remove('open');">
              ${state.t('continueShopping')}
            </a>
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: var(--space-md);">
            ${cart.map(item => `
              <div style="display: flex; gap: var(--space-md); padding-bottom: var(--space-md); border-bottom: 1px solid var(--color-border-subtle);">
                <img src="${item.image}" alt="${item.name}" style="width: 76px; height: 98px; object-fit: cover; border-radius: var(--radius-xs); background: var(--color-surface-muted);" />
                
                <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                      <h4 style="font-size: 14px; font-weight: 600; line-height: 1.4; color: var(--color-text-main);">
                        ${lang === 'ar' ? (item.nameAr || item.name) : item.name}
                      </h4>
                      <button class="remove-cart-item-btn" data-prod="${item.productId}" data-sku="${item.variantSku}" style="color: var(--color-text-subtle); padding: 2px;" title="${state.t('remove')}">
                        &times;
                      </button>
                    </div>

                    <div style="display: flex; gap: 8px; font-size: 12px; color: var(--color-text-muted); margin-top: 4px;">
                      ${item.color ? `<span>${item.color}</span>` : ''}
                      ${item.color && item.size ? `<span>•</span>` : ''}
                      ${item.size ? `<span>${state.t('size')}: <strong>${item.size}</strong></span>` : ''}
                    </div>
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                    <!-- Stepper -->
                    <div style="display: flex; align-items: center; border: 1px solid var(--color-border); border-radius: var(--radius-xs);">
                      <button class="cart-qty-btn" data-action="dec" data-prod="${item.productId}" data-sku="${item.variantSku}" style="padding: 4px 8px; font-size: 14px;">-</button>
                      <span style="font-size: 12px; font-weight: 600; padding: 0 8px; min-width: 24px; text-align: center;">${item.quantity}</span>
                      <button class="cart-qty-btn" data-action="inc" data-prod="${item.productId}" data-sku="${item.variantSku}" style="padding: 4px 8px; font-size: 14px;">+</button>
                    </div>

                    <span style="font-size: 14px; font-weight: 700; color: var(--color-brand);">
                      ${state.formatPrice(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Drawer Footer -->
      ${cart.length > 0 ? `
        <div class="cart-drawer-footer">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px;">
            <span style="color: var(--color-text-muted);">${state.t('subtotal')}</span>
            <span style="font-weight: 700; font-size: 16px; color: var(--color-brand);">${state.formatPrice(subtotal)}</span>
          </div>

          <p style="font-size: 11px; color: var(--color-text-subtle); margin-bottom: var(--space-md);">
            ${lang === 'ar' ? 'الضرائب والشحن يتم احتسابها بدقة عند شاشة الدفع' : 'Taxes and shipping calculated at checkout.'}
          </p>

          <div style="display: flex; flex-direction: column; gap: var(--space-xs);">
            <a href="#checkout" id="drawer-checkout-btn" class="btn btn-primary btn-full">
              ${state.t('checkout')} • ${state.formatPrice(subtotal)}
            </a>
            <a href="#cart" id="drawer-view-cart-btn" class="btn btn-secondary btn-full btn-sm">
              ${lang === 'ar' ? 'عرض السلة الكاملة وتطبيق الكوبون' : 'View Full Cart & Apply Coupon'}
            </a>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

export function setupCartDrawerEvents() {
  const closeBtn = document.getElementById('close-cart-drawer-btn');
  const drawer = document.getElementById('cart-drawer');
  if (closeBtn && drawer) {
    closeBtn.onclick = () => drawer.classList.remove('open');
  }

  // Steppers & Removes
  document.querySelectorAll('.remove-cart-item-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const prod = target.getAttribute('data-prod');
      const sku = target.getAttribute('data-sku');
      if (prod && sku) {
        state.removeFromCart(prod, sku);
      }
    });
  });

  document.querySelectorAll('.cart-qty-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const action = target.getAttribute('data-action');
      const prod = target.getAttribute('data-prod');
      const sku = target.getAttribute('data-sku');
      if (prod && sku) {
        const item = state.getCart().find(i => i.productId === prod && i.variantSku === sku);
        if (item) {
          const newQty = action === 'inc' ? item.quantity + 1 : item.quantity - 1;
          state.updateCartQuantity(prod, sku, newQty);
        }
      }
    });
  });

  const checkoutBtn = document.getElementById('drawer-checkout-btn');
  if (checkoutBtn && drawer) {
    checkoutBtn.onclick = () => drawer.classList.remove('open');
  }
  const viewCartBtn = document.getElementById('drawer-view-cart-btn');
  if (viewCartBtn && drawer) {
    viewCartBtn.onclick = () => drawer.classList.remove('open');
  }
}
