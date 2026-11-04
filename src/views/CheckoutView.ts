import { state, showToast } from '../state';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export async function renderCheckoutView(): Promise<string> {
  const lang = state.getLang();
  const cart = state.getCart();

  if (cart.length === 0) {
    return `
      <div class="container" style="padding: 100px 0; text-align: center;">
        <h3 style="font-family: var(--font-editorial); font-size: 32px; margin-bottom: 16px;">${state.t('emptyCart')}</h3>
        <a href="#shop" class="btn btn-primary">${state.t('continueShopping')}</a>
      </div>
    `;
  }

  // Fetch active shipping zones
  let shippingZones: any[] = [];
  try {
    const snap = await getDocs(collection(db, 'shippingZones'));
    shippingZones = snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(z => z.isActive !== false);
  } catch (e) {
    console.error('Error fetching shipping zones', e);
  }

  if (shippingZones.length === 0) {
    shippingZones = [
      { id: 'zone-local', name: 'UAE & Gulf Express', nameAr: 'الإمارات ودول الخليج السريع', cost: 15, estimatedDays: '1-2 Days' },
      { id: 'zone-egypt', name: 'Egypt & Levant Delivery', nameAr: 'مصر والشام توصيل مميز', cost: 18, estimatedDays: '2-4 Days' },
      { id: 'zone-global', name: 'Worldwide Express', nameAr: 'الشحن العالمي السريع', cost: 25, estimatedDays: '3-6 Days' },
    ];
  }

  const subtotal = state.getCartSubtotal();
  const appliedCoupon = state.getAppliedCoupon();
  const discount = appliedCoupon ? appliedCoupon.discount : 0;
  const settings = state.getSettings();

  const initialZone = shippingZones[0];
  const initialShippingCost = subtotal >= (settings.freeShippingThreshold || 250) ? 0 : initialZone.cost;
  const taxAmount = (settings.enableTax && settings.taxPercentage) ? ((subtotal - discount) * settings.taxPercentage) / 100 : 0;
  const finalTotal = Math.max(0, subtotal - discount + initialShippingCost + taxAmount);
  const currentUser = state.getUser();

  return `
    <div id="checkout-container" class="checkout-page container animate-fade-in" style="padding-top: var(--space-2xl); padding-bottom: var(--space-4xl);">
      <div style="margin-bottom: var(--space-2xl); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-md);">
        <h1 style="font-family: var(--font-editorial); font-size: clamp(28px, 4vw, 40px); font-weight: 500;">
          ${state.t('checkout')}
        </h1>
        <p style="font-size: 13px; color: var(--color-text-muted);">
          🔒 ${lang === 'ar' ? 'بيانات مشفرة ومحمية بالكامل • خدمة تغليف الهدايا متضمنة' : 'Encrypted & Secure Checkout • Signature Keepsake Box Included'}
        </p>
      </div>

      <form id="checkout-form" class="checkout-layout-grid">
        
        <!-- Left Column: Delivery & Payment Details -->
        <div>
          <!-- Step 1: Customer Contact Info -->
          <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xs); padding: var(--space-xl); margin-bottom: var(--space-xl);">
            <h3 style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: var(--space-lg); border-bottom: 1px solid var(--color-border-subtle); padding-bottom: 8px;">
              1. ${lang === 'ar' ? 'بيانات العميل والتواصل' : 'Customer Details'}
            </h3>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);" class="form-row-2">
              <div class="form-group">
                <label class="form-label">${state.t('fullName')} *</label>
                <input type="text" id="cust-name" required class="form-input" value="${currentUser?.displayName || ''}" placeholder="e.g. Princess Elena" />
              </div>

              <div class="form-group">
                <label class="form-label">${state.t('phone')} * (WhatsApp / SMS)</label>
                <input type="tel" id="cust-phone" required class="form-input" placeholder="e.g. +971 50 123 4567" />
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">${state.t('email')} *</label>
              <input type="email" id="cust-email" required class="form-input" value="${currentUser?.email || ''}" placeholder="e.g. elena@example.com" />
            </div>
          </div>

          <!-- Step 2: Shipping Address & Zone -->
          <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xs); padding: var(--space-xl); margin-bottom: var(--space-xl);">
            <h3 style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: var(--space-lg); border-bottom: 1px solid var(--color-border-subtle); padding-bottom: 8px;">
              2. ${state.t('shippingAddress')}
            </h3>

            <div class="form-group">
              <label class="form-label">${state.t('governorate')} / ${lang === 'ar' ? 'منطقة الشحن' : 'Shipping Zone'} *</label>
              <select id="cust-zone-select" required class="form-select">
                ${shippingZones.map((z, idx) => `
                  <option value="${z.id}" data-cost="${z.cost}" ${idx === 0 ? 'selected' : ''}>
                    ${lang === 'ar' ? (z.nameAr || z.name) : z.name} (${state.formatPrice(z.cost)} • ${lang === 'ar' ? (z.estimatedDaysAr || z.estimatedDays) : z.estimatedDays})
                  </option>
                `).join('')}
              </select>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);" class="form-row-2">
              <div class="form-group">
                <label class="form-label">${state.t('city')} *</label>
                <input type="text" id="cust-city" required class="form-input" placeholder="e.g. Downtown Dubai / Zamalek" />
              </div>

              <div class="form-group">
                <label class="form-label">${state.t('buildingDetails')}</label>
                <input type="text" id="cust-building" class="form-input" placeholder="e.g. Tower 2, Apt 1401" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">${state.t('streetAddress')} *</label>
              <textarea id="cust-address" required rows="2" class="form-textarea" placeholder="${lang === 'ar' ? 'اسم الشارع، رقم العقار، المعالم المميزة...' : 'Street name, landmark, villa number...'}"></textarea>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">${lang === 'ar' ? 'ملاحظات إضافية للتوصيل (اختياري)' : 'Delivery Instructions (Optional)'}</label>
              <input type="text" id="cust-notes" class="form-input" placeholder="${lang === 'ar' ? 'مثال: يرجى الاتصال قبل الوصول' : 'e.g. Leave with concierge'}" />
            </div>
          </div>

          <!-- Step 3: Payment Options -->
          <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xs); padding: var(--space-xl);">
            <h3 style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: var(--space-lg); border-bottom: 1px solid var(--color-border-subtle); padding-bottom: 8px;">
              3. ${state.t('paymentMethod')}
            </h3>

            <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
              <!-- Cash on Delivery -->
              <label style="display: flex; align-items: flex-start; gap: var(--space-sm); padding: var(--space-md); border: 1px solid var(--color-brand); border-radius: var(--radius-xs); background: var(--color-surface-muted); cursor: pointer;">
                <input type="radio" name="payment-method" value="cod" checked style="margin-top: 3px;" />
                <div>
                  <div style="font-weight: 600; font-size: 14px; color: var(--color-text-main);">
                    ${state.t('cod')}
                  </div>
                  <p style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">
                    ${lang === 'ar' ? 'ادفع نقداً أو عبر البطاقة عند استلام الطرد وتفحصه من مندوب التوصيل.' : 'Pay cash or card upon receiving and inspecting your garment from the courier.'}
                  </p>
                </div>
              </label>

              <!-- Online Card -->
              <label style="display: flex; align-items: flex-start; gap: var(--space-sm); padding: var(--space-md); border: 1px solid var(--color-border); border-radius: var(--radius-xs); cursor: pointer;">
                <input type="radio" name="payment-method" value="card" style="margin-top: 3px;" />
                <div>
                  <div style="font-weight: 600; font-size: 14px; color: var(--color-text-main);">
                    ${state.t('creditCard')} (Visa / Mastercard / Amex)
                  </div>
                  <p style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">
                    ${lang === 'ar' ? 'بوابة دفع إلكتروني آمنة ومشفرة بتقنية 3D Secure.' : 'Encrypted 256-bit payment gateway.'}
                  </p>
                </div>
              </label>

              <!-- Apple Pay / Wallet -->
              <label style="display: flex; align-items: flex-start; gap: var(--space-sm); padding: var(--space-md); border: 1px solid var(--color-border); border-radius: var(--radius-xs); cursor: pointer;">
                <input type="radio" name="payment-method" value="wallet" style="margin-top: 3px;" />
                <div>
                  <div style="font-weight: 600; font-size: 14px; color: var(--color-text-main);">
                    ${state.t('applePay')}
                  </div>
                  <p style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">
                    ${lang === 'ar' ? 'دفع فوري عبر Apple Pay أو Google Pay.' : 'Instant 1-click biometric mobile checkout.'}
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <!-- Right Column: Order Review & Confirmation -->
        <div>
          <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xs); padding: var(--space-xl); position: sticky; top: 100px;">
            <h3 style="font-family: var(--font-editorial); font-size: 22px; margin-bottom: var(--space-md); border-bottom: 1px solid var(--color-border); padding-bottom: 8px;">
              ${state.t('orderSummary')}
            </h3>

            <!-- Item Mini Previews -->
            <div style="display: flex; flex-direction: column; gap: var(--space-sm); max-height: 240px; overflow-y: auto; margin-bottom: var(--space-lg); border-bottom: 1px solid var(--color-border-subtle); padding-bottom: var(--space-md);">
              ${cart.map(item => `
                <div style="display: flex; gap: var(--space-sm); align-items: center; font-size: 13px;">
                  <img src="${item.image}" alt="${item.name}" style="width: 44px; height: 56px; object-fit: cover; border-radius: 2px;" />
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      ${lang === 'ar' ? (item.nameAr || item.name) : item.name}
                    </div>
                    <div style="font-size: 11px; color: var(--color-text-subtle);">
                      ${item.color} • ${item.size} • Qty: ${item.quantity}
                    </div>
                  </div>
                  <span style="font-weight: 600;">${state.formatPrice(item.price * item.quantity)}</span>
                </div>
              `).join('')}
            </div>

            <!-- Price Breakdown -->
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 14px; margin-bottom: var(--space-xl);">
              <div style="display: flex; justify-content: space-between; color: var(--color-text-muted);">
                <span>${state.t('subtotal')}</span>
                <span>${state.formatPrice(subtotal)}</span>
              </div>

              ${discount > 0 ? `
                <div style="display: flex; justify-content: space-between; color: var(--color-success); font-weight: 500;">
                  <span>${lang === 'ar' ? 'الخصم المطبق' : 'Discount'} (${appliedCoupon?.code})</span>
                  <span>-${state.formatPrice(discount)}</span>
                </div>
              ` : ''}

              <div style="display: flex; justify-content: space-between; color: var(--color-text-muted);">
                <span>${state.t('shipping')}</span>
                <span id="checkout-shipping-val">
                  ${initialShippingCost === 0 ? `<strong style="color: var(--color-success);">${state.t('freeShipping')}</strong>` : state.formatPrice(initialShippingCost)}
                </span>
              </div>

              ${taxAmount > 0 ? `
                <div style="display: flex; justify-content: space-between; color: var(--color-text-muted);">
                  <span>${state.t('tax')} (${settings.taxPercentage}%)</span>
                  <span>${state.formatPrice(taxAmount)}</span>
                </div>
              ` : ''}

              <div style="border-top: 1px solid var(--color-border); padding-top: 12px; display: flex; justify-content: space-between; font-size: 18px; font-weight: 600; color: var(--color-brand);">
                <span>${state.t('total')}</span>
                <span id="checkout-total-val" style="font-family: var(--font-editorial); font-size: 24px;">${state.formatPrice(finalTotal)}</span>
              </div>
            </div>

            <!-- Submit Button -->
            <button type="submit" id="submit-order-btn" class="btn btn-primary btn-lg btn-full" style="font-size: 14px;">
              ${state.t('placeOrder')}
            </button>

            <div style="margin-top: var(--space-md); text-align: center; font-size: 11px; color: var(--color-text-subtle);">
              <i class="fa-solid fa-star" aria-hidden="true"></i> ${lang === 'ar' ? 'سيتم إرسال رسالة بريد إلكتروني وSMS بتفاصيل الطلب فوراً' : 'Order confirmation will be sent via SMS & Email'}
            </div>
          </div>
        </div>

      </form>
    </div>
  `;
}

export function setupCheckoutEvents() {
  const zoneSelect = document.getElementById('cust-zone-select') as HTMLSelectElement;
  const shippingValEl = document.getElementById('checkout-shipping-val');
  const totalValEl = document.getElementById('checkout-total-val');

  function recalculateTotal() {
    const subtotal = state.getCartSubtotal();
    const appliedCoupon = state.getAppliedCoupon();
    const discount = appliedCoupon ? appliedCoupon.discount : 0;
    const settings = state.getSettings();

    let shipping = 15;
    if (zoneSelect) {
      const opt = zoneSelect.options[zoneSelect.selectedIndex];
      shipping = parseFloat(opt.getAttribute('data-cost') || '15');
    }

    if (subtotal >= (settings.freeShippingThreshold || 250)) {
      shipping = 0;
    }

    const tax = (settings.enableTax && settings.taxPercentage) ? ((subtotal - discount) * settings.taxPercentage) / 100 : 0;
    const total = Math.max(0, subtotal - discount + shipping + tax);

    if (shippingValEl) {
      shippingValEl.innerHTML = shipping === 0 ? `<strong style="color: var(--color-success);">${state.t('freeShipping')}</strong>` : state.formatPrice(shipping);
    }
    if (totalValEl) {
      totalValEl.textContent = state.formatPrice(total);
    }
  }

  if (zoneSelect) {
    zoneSelect.onchange = recalculateTotal;
  }

  const form = document.getElementById('checkout-form') as HTMLFormElement;
  const submitBtn = document.getElementById('submit-order-btn') as HTMLButtonElement;

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const lang = state.getLang();

      const fullName = (document.getElementById('cust-name') as HTMLInputElement).value.trim();
      const phoneNumber = (document.getElementById('cust-phone') as HTMLInputElement).value.trim();
      const email = (document.getElementById('cust-email') as HTMLInputElement).value.trim();
      const zoneId = (document.getElementById('cust-zone-select') as HTMLSelectElement).value;
      const city = (document.getElementById('cust-city') as HTMLInputElement).value.trim();
      const building = (document.getElementById('cust-building') as HTMLInputElement).value.trim();
      const address = (document.getElementById('cust-address') as HTMLTextAreaElement).value.trim();
      const notes = (document.getElementById('cust-notes') as HTMLInputElement).value.trim();
      const paymentMethod = (form.querySelector('input[name="payment-method"]:checked') as HTMLInputElement)?.value || 'cod';

      if (!fullName || !phoneNumber || !address) {
        showToast(lang === 'ar' ? 'يرجى إكمال جميع الحقول المطلوبة' : 'Please fill all required fields', 'warning');
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = lang === 'ar' ? 'جاري التحقق واعتماد الطلب على السيرفر...' : 'Verifying and placing order...';

        const payload = {
          items: state.getCart().map(i => ({
            productId: i.productId,
            variantSku: i.variantSku,
            color: i.color,
            size: i.size,
            quantity: i.quantity,
            price: i.price,
            image: i.image
          })),
          customerInfo: {
            fullName,
            phoneNumber,
            email,
            governorate: zoneId,
            city,
            building,
            address,
            userId: state.getUser()?.uid || null
          },
          shippingZoneId: zoneId,
          couponCode: state.getAppliedCoupon()?.code || null,
          paymentMethod,
          notes
        };

        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.success) {
          const orderNumber = data.orderNumber;
          const orderTotal = data.total;

          // Clear cart
          state.clearCart();

          // Render Luxury Confirmation Screen
          const container = document.getElementById('checkout-container');
          if (container) {
            container.innerHTML = `
              <div style="max-width: 680px; margin: 40px auto; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: var(--space-3xl); text-align: center; box-shadow: var(--shadow-md);">
                <div style="width: 64px; height: 64px; border-radius: 50%; background: #f0fdf4; color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto var(--space-lg) auto;">
                  ✓
                </div>

                <span style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-brand-gold); display: block; margin-bottom: 6px;">
                  ${lang === 'ar' ? 'تم تأكيد طلبك بنجاح' : 'Order Confirmed'}
                </span>

                <h3 style="font-family: var(--font-editorial); font-size: clamp(26px, 4vw, 36px); font-weight: 500; margin-bottom: var(--space-sm);">
                  ${lang === 'ar' ? 'شكراً لاختيارك براند EIGHTY-EIGHT' : 'Thank You For Choosing EIGHTY-EIGHT'}
                </h3>

                <p style="font-size: 14px; color: var(--color-text-muted); line-height: 1.7; margin-bottom: var(--space-xl);">
                  ${lang === 'ar' 
                    ? `تم تسجيل أوردرك بنجاح برقم <strong style="color: var(--color-brand);">${orderNumber}</strong> بإجمالي <strong>${state.formatPrice(orderTotal)}</strong>. بيتم تجهيز القطع وتغليفها بعناية فائقة وبيتواصل معاك مندوب الشحن لتأكيد ميعاد التسليم.`
                    : `Your order reference <strong style="color: var(--color-brand);">${orderNumber}</strong> for <strong>${state.formatPrice(orderTotal)}</strong> has been confirmed and is being packed. Our courier will contact you soon.`}
                </p>

                <!-- Order Summary Details -->
                <div style="background: var(--color-surface-muted); border-radius: var(--radius-xs); padding: var(--space-lg); text-align: ${lang === 'ar' ? 'right' : 'left'}; margin-bottom: var(--space-xl); font-size: 13px; line-height: 1.8;">
                  <div><strong>${state.t('fullName')}:</strong> ${fullName}</div>
                  <div><strong>${state.t('phone')}:</strong> ${phoneNumber}</div>
                  <div><strong>${state.t('email')}:</strong> ${email}</div>
                  <div><strong>${state.t('shippingAddress')}:</strong> ${city}, ${address}</div>
                  <div><strong>${state.t('paymentMethod')}:</strong> ${paymentMethod.toUpperCase()}</div>
                </div>

                <!-- Actions: Print Invoice & Track -->
                <div style="display: flex; gap: var(--space-md); justify-content: center; flex-wrap: wrap;">
                  <button id="print-order-btn" class="btn btn-secondary btn-sm" onclick="window.print();">
                    🖨 ${state.t('printInvoice')}
                  </button>
                  <a href="#track?order=${orderNumber}" class="btn btn-gold btn-sm">
                    🔍 ${state.t('trackOrder')}
                  </a>
                  <a href="#shop" class="btn btn-primary btn-sm">
                    ${state.t('continueShopping')}
                  </a>
                </div>
              </div>
            `;
          }

          showToast(lang === 'ar' ? 'تم تسجيل وتأكيد الطلب بنجاح!' : 'Order confirmed successfully!', 'success');
        } else {
          showToast(data.message || 'Checkout failed', 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = state.t('placeOrder');
        }
      } catch (err: any) {
        showToast(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = state.t('placeOrder');
      }
    };
  }
}
