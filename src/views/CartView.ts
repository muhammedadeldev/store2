import { state, showToast } from '../state';

export function renderCartView(): string {
  const lang = state.getLang();
  const cart = state.getCart();
  const subtotal = state.getCartSubtotal();
  const appliedCoupon = state.getAppliedCoupon();
  const settings = state.getSettings();

  const discount = appliedCoupon ? appliedCoupon.discount : 0;
  const freeThreshold = settings.freeShippingThreshold || 250;
  const shippingCost = subtotal >= freeThreshold ? 0 : (settings.defaultShippingCost || 20);
  const taxAmount = (settings.enableTax && settings.taxPercentage) ? ((subtotal - discount) * settings.taxPercentage) / 100 : 0;
  const finalTotal = Math.max(0, subtotal - discount + shippingCost + taxAmount);

  return `
    <div class="cart-page container animate-fade-in" style="padding-top: var(--space-2xl); padding-bottom: var(--space-4xl);">
      <div style="margin-bottom: var(--space-2xl); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-md);">
        <h1 style="font-family: var(--font-editorial); font-size: clamp(28px, 4vw, 40px); font-weight: 500;">
          ${state.t('cart')}
        </h1>
        <p style="font-size: 14px; color: var(--color-text-muted);">
          ${cart.length} ${state.t('itemCount')}
        </p>
      </div>

      ${cart.length === 0 ? `
        <div style="text-align: center; padding: var(--space-4xl) 0; background: var(--color-surface); border: 1px dashed var(--color-border); border-radius: var(--radius-sm);">
          <i class="fa-solid fa-bag-shopping" aria-hidden="true" style="font-size: 64px;"></i>
          <h3 style="font-size: 22px; font-weight: 500; margin-bottom: 8px;">${state.t('emptyCart')}</h3>
          <p style="font-size: 14px; color: var(--color-text-muted); max-width: 320px; margin: 0 auto var(--space-xl) auto;">
            ${lang === 'ar' ? 'لم تقم بإضافة أي قطع إلى سلة التسوق بعد.' : 'Your shopping cart is currently empty.'}
          </p>
          <a href="#shop" class="btn btn-primary btn-lg">
            ${state.t('continueShopping')}
          </a>
        </div>
      ` : `
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: var(--space-3xl);" class="cart-layout-grid">
          
          <!-- Items Table -->
          <div>
            <div style="display: flex; flex-direction: column; gap: var(--space-lg);">
              ${cart.map(item => `
                <div style="display: flex; gap: var(--space-lg); padding: var(--space-lg); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xs); align-items: center;" class="cart-item-row">
                  <img src="${item.image}" alt="${item.name}" style="width: 90px; height: 115px; object-fit: cover; border-radius: var(--radius-xs); background: var(--color-surface-muted);" />
                  
                  <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                      <div>
                        <h3 style="font-size: 16px; font-weight: 500; margin-bottom: 4px; color: var(--color-text-main);">
                          ${lang === 'ar' ? (item.nameAr || item.name) : item.name}
                        </h3>
                        <span style="font-size: 11px; color: var(--color-text-subtle); text-transform: uppercase; letter-spacing: 0.05em;">SKU: ${item.variantSku}</span>
                      </div>
                      
                      <button class="remove-cart-item-btn" data-prod="${item.productId}" data-sku="${item.variantSku}" style="color: var(--color-danger); font-size: 12px; font-weight: 600; cursor: pointer;">
                        ${state.t('remove')}
                      </button>
                    </div>

                    <div style="display: flex; gap: 12px; font-size: 13px; color: var(--color-text-muted); margin-top: 8px;">
                      ${item.color ? `<span>${state.t('color')}: <strong>${item.color}</strong></span>` : ''}
                      ${item.size ? `<span>${state.t('size')}: <strong>${item.size}</strong></span>` : ''}
                      <span>${lang === 'ar' ? 'سعر القطعة' : 'Unit Price'}: <strong>${state.formatPrice(item.price)}</strong></span>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px;">
                      <!-- Quantity Stepper -->
                      <div style="display: flex; align-items: center; border: 1px solid var(--color-border); border-radius: var(--radius-xs); background: #ffffff;">
                        <button class="cart-qty-btn" data-action="dec" data-prod="${item.productId}" data-sku="${item.variantSku}" style="padding: 6px 12px; font-size: 14px;">-</button>
                        <span style="font-size: 13px; font-weight: 600; padding: 0 10px; min-width: 28px; text-align: center;">${item.quantity}</span>
                        <button class="cart-qty-btn" data-action="inc" data-prod="${item.productId}" data-sku="${item.variantSku}" style="padding: 6px 12px; font-size: 14px;">+</button>
                      </div>

                      <span style="font-size: 16px; font-weight: 600; color: var(--color-brand); font-family: var(--font-editorial);">
                        ${state.formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- Clear Cart & Continue Browsing -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-xl);">
              <a href="#shop" class="btn btn-secondary btn-sm">
                ← ${state.t('continueShopping')}
              </a>
              <button id="clear-cart-btn" class="btn btn-ghost btn-sm" style="color: var(--color-danger); font-size: 12px;">
                ${lang === 'ar' ? 'تفريغ السلة بالكامل <i class="fa-solid fa-trash" aria-hidden="true"></i>' : 'Clear Entire Cart <i class="fa-solid fa-trash" aria-hidden="true"></i>'}
              </button>
            </div>
          </div>

          <!-- Order Summary & Checkout Card -->
          <div>
            <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xs); padding: var(--space-xl); position: sticky; top: 100px;">
              <h3 style="font-family: var(--font-editorial); font-size: 22px; margin-bottom: var(--space-lg); border-bottom: 1px solid var(--color-border); padding-bottom: 10px;">
                ${state.t('orderSummary')}
              </h3>

              <!-- Coupon Application Input -->
              <div style="margin-bottom: var(--space-lg); border-bottom: 1px solid var(--color-border-subtle); padding-bottom: var(--space-md);">
                <label class="form-label" style="font-size: 11px;">${state.t('couponCode')}</label>
                <div style="display: flex; gap: var(--space-xs);">
                  <input type="text" id="coupon-input" value="${appliedCoupon ? appliedCoupon.code : ''}" placeholder="e.g. LUXE15" class="form-input" style="text-transform: uppercase; font-size: 12px; padding: 8px 12px;" />
                  <button type="button" id="apply-coupon-btn" class="btn btn-primary btn-sm" style="padding: 8px 14px;">
                    ${state.t('applyCoupon')}
                  </button>
                </div>
                ${appliedCoupon ? `
                  <div style="margin-top: 6px; font-size: 11px; color: var(--color-success); display: flex; justify-content: space-between;">
                    <span>✓ ${lang === 'ar' ? `تم تفعيل الكوبون "${appliedCoupon.code}"` : `Coupon "${appliedCoupon.code}" applied`}</span>
                    <button id="remove-coupon-btn" style="color: var(--color-danger); font-size: 11px; text-decoration: underline;">${state.t('remove')}</button>
                  </div>
                ` : `
                  <p style="font-size: 11px; color: var(--color-text-subtle); margin-top: 4px;">
                    ${lang === 'ar' ? 'جرب الكوبونات الترحيبية: LUXE15 أو WELCOME10' : 'Try promo codes: LUXE15 or WELCOME10'}
                  </p>
                `}
              </div>

              <!-- Price Breakdown -->
              <div style="display: flex; flex-direction: column; gap: 10px; font-size: 14px; margin-bottom: var(--space-xl);">
                <div style="display: flex; justify-content: space-between; color: var(--color-text-muted);">
                  <span>${state.t('subtotal')}</span>
                  <span>${state.formatPrice(subtotal)}</span>
                </div>

                ${discount > 0 ? `
                  <div style="display: flex; justify-content: space-between; color: var(--color-success); font-weight: 500;">
                    <span>${lang === 'ar' ? 'الخصم المطبق' : 'Discount'}</span>
                    <span>-${state.formatPrice(discount)}</span>
                  </div>
                ` : ''}

                <div style="display: flex; justify-content: space-between; color: var(--color-text-muted);">
                  <span>${state.t('shipping')}</span>
                  <span>${shippingCost === 0 ? `<strong style="color: var(--color-success);">${state.t('freeShipping')}</strong>` : state.formatPrice(shippingCost)}</span>
                </div>

                ${taxAmount > 0 ? `
                  <div style="display: flex; justify-content: space-between; color: var(--color-text-muted);">
                    <span>${state.t('tax')} (${settings.taxPercentage}%)</span>
                    <span>${state.formatPrice(taxAmount)}</span>
                  </div>
                ` : ''}

                <div style="border-top: 1px solid var(--color-border); padding-top: 12px; display: flex; justify-content: space-between; font-size: 18px; font-weight: 600; color: var(--color-brand);">
                  <span>${state.t('total')}</span>
                  <span style="font-family: var(--font-editorial); font-size: 24px;">${state.formatPrice(finalTotal)}</span>
                </div>
              </div>

              <!-- Checkout CTA -->
              <a href="#checkout" class="btn btn-primary btn-lg btn-full" style="font-size: 14px;">
                ${state.t('checkout')} • ${state.formatPrice(finalTotal)}
              </a>

              <div style="margin-top: var(--space-md); text-align: center; font-size: 11px; color: var(--color-text-subtle);">
                🔒 ${lang === 'ar' ? 'دفع آمن ومشفر 100% مع ضمان فحص القطعة عند الاستلام' : '100% Secure Checkout with White-Glove Guarantee'}
              </div>
            </div>
          </div>

        </div>
      `}
    </div>
  `;
}

export function setupCartEvents() {
  // Steppers and item removals
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

  const clearBtn = document.getElementById('clear-cart-btn');
  if (clearBtn) {
    clearBtn.onclick = () => {
      if (confirm(state.getLang() === 'ar' ? 'هل أنت متأكد من تفريغ سلة التسوق بالكامل؟' : 'Are you sure you want to clear your shopping cart?')) {
        state.clearCart();
      }
    };
  }

  // Apply Coupon button
  const applyCouponBtn = document.getElementById('apply-coupon-btn');
  const couponInput = document.getElementById('coupon-input') as HTMLInputElement;

  if (applyCouponBtn && couponInput) {
    applyCouponBtn.onclick = async () => {
      const code = couponInput.value.trim();
      if (!code) {
        showToast(state.getLang() === 'ar' ? 'يرجى إدخال كود الكوبون' : 'Please enter promo code', 'warning');
        return;
      }

      try {
        applyCouponBtn.textContent = '...';
        const res = await fetch('/api/coupons/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, subtotal: state.getCartSubtotal() })
        });
        const data = await res.json();

        if (data.valid) {
          state.setAppliedCoupon({
            code: data.code,
            discount: data.calculatedDiscount,
            type: data.discountType
          });
          showToast(state.getLang() === 'ar' ? `تم تطبيق خصم بقيمة ${state.formatPrice(data.calculatedDiscount)}` : `Discount of ${state.formatPrice(data.calculatedDiscount)} applied!`, 'success');
        } else {
          showToast(data.message || 'Invalid coupon', 'error');
        }
      } catch (err: any) {
        showToast(err.message, 'error');
      } finally {
        applyCouponBtn.textContent = state.t('applyCoupon');
      }
    };
  }

  const removeCouponBtn = document.getElementById('remove-coupon-btn');
  if (removeCouponBtn) {
    removeCouponBtn.onclick = () => {
      state.setAppliedCoupon(null);
      showToast(state.getLang() === 'ar' ? 'تمت إزالة الكوبون' : 'Coupon removed', 'info');
    };
  }
}
