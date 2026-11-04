import { state, showToast } from '../state';

export async function renderTrackView(urlParams: URLSearchParams): Promise<string> {
  const lang = state.getLang();
  const orderParam = (urlParams.get('order') || '').trim();

  let foundOrder: any = null;
  let fetchError = false;

  if (orderParam) {
    try {
      const res = await fetch(`/api/orders/track/${encodeURIComponent(orderParam.toUpperCase())}`);
      const data = await res.json();
      if (data.success && data.order) {
        foundOrder = data.order;
      } else {
        fetchError = true;
      }
    } catch (e) {
      console.error('Error tracking order via API', e);
      fetchError = true;
    }
  }

  const steps = [
    { key: 'new', label: lang === 'ar' ? 'استلام الطلب' : 'Order Placed', desc: lang === 'ar' ? 'تم تسجيل الأوردر بنجاح' : 'Registered' },
    { key: 'confirmed', label: lang === 'ar' ? 'تأكيد الطلب' : 'Confirmed', desc: lang === 'ar' ? 'تمت مراجعة البيانات هاتفياً' : 'Verified' },
    { key: 'processing', label: lang === 'ar' ? 'التجهيز والتغليف' : 'Processing', desc: lang === 'ar' ? 'جاري تجهيز القطع والتغليف الفاخر' : 'Packing in Box' },
    { key: 'shipped', label: lang === 'ar' ? 'خرج مع مندوب التوصيل' : 'Out for Delivery', desc: lang === 'ar' ? 'في الطريق إلى عنوانك' : 'With Courier' },
    { key: 'delivered', label: lang === 'ar' ? 'تم الاستلام بنجاح' : 'Delivered', desc: lang === 'ar' ? 'تم تسليم الأوردر للعميل' : 'Completed' }
  ];

  function getStepIndex(status: string) {
    if (status === 'cancelled') return -1;
    if (status === 'delivered') return 4;
    if (status === 'shipped') return 3;
    if (status === 'processing' || status === 'packed') return 2;
    if (status === 'confirmed') return 1;
    return 0;
  }

  const currentStep = foundOrder ? getStepIndex(foundOrder.status) : 0;
  const isCancelled = foundOrder && foundOrder.status === 'cancelled';

  return `
    <div class="track-page container animate-fade-in" style="padding-top: 48px; padding-bottom: 80px; max-width: 820px; font-family: 'Cairo', sans-serif;">
      
      <!-- Material 3 Header Section -->
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-flex; align-items: center; gap: 8px; background: #dcfce7; color: #166534; padding: 6px 16px; border-radius: 9999px; font-size: 13px; font-weight: 700; margin-bottom: 12px;">
          <span><i class="fa-solid fa-box" aria-hidden="true"></i></span>
          <span>${lang === 'ar' ? 'خدمة المتابعة والشحن المباشر' : 'Live Order Tracking'}</span>
        </div>
        <h1 style="font-size: clamp(26px, 3.5vw, 36px); font-weight: 800; color: #111827; margin-bottom: 8px;">
          ${state.t('trackOrder')}
        </h1>
        <p style="font-size: 14px; color: #64748b; max-width: 540px; margin: 0 auto;">
          ${lang === 'ar' ? 'أدخل كود الطلب الخاص بك (مثال: ORD-577524-520) لمتابعة خط سير التجهيز والشحن حتى باب منزلك.' : 'Enter your order reference code (e.g. ORD-577524-520) to view real-time courier milestones.'}
        </p>
      </div>

      <!-- M3 Search Outlined Card -->
      <div class="m3-card-elevated" style="background: #ffffff; border-radius: 24px; padding: 24px; margin-bottom: 32px; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0;">
        <form id="track-search-form" style="display: flex; gap: 12px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 260px; position: relative;">
            <input 
              type="text" 
              id="track-order-input" 
              required 
              value="${orderParam}" 
              placeholder="${lang === 'ar' ? 'مثال: ORD-577524-520' : 'e.g. ORD-577524-520'}" 
              class="m3-input" 
              style="width: 100%; height: 52px; padding: 0 18px; border-radius: 16px; border: 2px solid #cbd5e1; font-size: 15px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; outline: none; transition: all 0.2s; box-sizing: border-box;" 
            />
          </div>
          <button type="submit" class="btn-m3-filled" style="height: 52px; padding: 0 28px; border-radius: 16px; background: #0f172a; color: #ffffff; font-weight: 700; font-size: 15px; display: inline-flex; align-items: center; gap: 8px; border: none; cursor: pointer; transition: all 0.2s;">
            <i class="fa-solid fa-magnifying-glass" aria-hidden="true" style="font-size: 18px;"></i>
            <span>${lang === 'ar' ? 'بحث وتتبع' : 'Track'}</span>
          </button>
        </form>
      </div>

      <!-- Results Display -->
      ${foundOrder ? `
        <div class="m3-card-elevated" style="background: #ffffff; border-radius: 28px; padding: 32px; box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Order Header Bar -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 28px; flex-wrap: wrap; gap: 12px;">
            <div>
              <span style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase;">
                ${lang === 'ar' ? 'كود الطلب المسجل' : 'Order Reference'}
              </span>
              <h3 style="font-size: 26px; font-weight: 800; color: #0f172a; margin-top: 2px; letter-spacing: 0.02em;">
                ${foundOrder.orderNumber}
              </h3>
              <span style="font-size: 12px; color: #94a3b8;">
                ${new Date(foundOrder.createdAt || Date.now()).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>

            <div>
              <span style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 16px; border-radius: 9999px; font-size: 13px; font-weight: 700; ${isCancelled ? 'background: #fef2f2; color: #b91c1c;' : 'background: #f0fdf4; color: #15803d;'}">
                <span>●</span>
                <span>${getStatusArabic(foundOrder.status)}</span>
              </span>
            </div>
          </div>

          <!-- M3 Stepper Progress Bar -->
          ${!isCancelled ? `
            <div class="track-stepper-container" style="margin-bottom: 36px; padding: 12px 0;">
              <div class="track-stepper-row" style="display: flex; justify-content: space-between; position: relative;">
                
                <!-- Connector Line -->
                <div class="track-connector-line" style="position: absolute; top: 18px; left: 8%; right: 8%; height: 4px; background: #e2e8f0; border-radius: 4px; z-index: 1;">
                  <div style="height: 100%; width: ${(currentStep / 4) * 100}%; background: #0f172a; border-radius: 4px; transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);"></div>
                </div>

                ${steps.map((st, i) => `
                  <div class="track-step-item" style="position: relative; z-index: 2; text-align: center; flex: 1;">
                    <div class="track-step-circle" style="width: 38px; height: 38px; border-radius: 50%; background: ${i <= currentStep ? '#0f172a' : '#ffffff'}; border: 3px solid ${i <= currentStep ? '#0f172a' : '#cbd5e1'}; color: ${i <= currentStep ? '#ffffff' : '#64748b'}; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; margin: 0 auto 10px auto; transition: all 0.3s; box-shadow: ${i === currentStep ? '0 0 0 4px rgba(15, 23, 42, 0.15)' : 'none'};">
                      ${i < currentStep ? '✓' : (i + 1)}
                    </div>
                    <span class="track-step-label" style="font-size: 13px; font-weight: ${i === currentStep ? '800' : '600'}; color: ${i <= currentStep ? '#0f172a' : '#94a3b8'}; display: block; line-height: 1.3;">
                      ${st.label}
                    </span>
                    <span class="track-step-desc" style="font-size: 11px; color: #94a3b8; display: block; margin-top: 2px;">
                      ${st.desc}
                    </span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : `
            <div style="padding: 16px; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 16px; color: #991b1b; margin-bottom: 24px; font-size: 14px; display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 20px;"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></span>
              <span>${lang === 'ar' ? 'تم إلغاء هذا الطلب وإعادة العناصر للمخزون.' : 'This order has been cancelled and items were returned to inventory.'}</span>
            </div>
          `}

          <!-- Courier Details Strip -->
          ${foundOrder.trackingNumber ? `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px 20px; border-radius: 16px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
              <div>
                <span style="font-size: 12px; color: #64748b; font-weight: 600;">${lang === 'ar' ? 'رقم بوليصة الشحن السريع:' : 'Waybill Tracking Number:'}</span>
                <span style="font-family: monospace; font-size: 15px; font-weight: 800; color: #0f172a; margin-right: 8px;">${foundOrder.trackingNumber}</span>
              </div>
              <span style="background: #1e293b; color: #ffffff; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 700;">
                EIGHTY-EIGHT Express Courier
              </span>
            </div>
          ` : ''}

          <!-- Order Items Breakdown -->
          <div style="margin-bottom: 28px;">
            <h4 style="font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #334155; margin-bottom: 14px;">
              ${lang === 'ar' ? 'محتويات الطرد' : 'Package Items'}
            </h4>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${(foundOrder.items || []).map((it: any) => `
                <div style="display: flex; gap: 14px; align-items: center; padding: 12px; background: #f8fafc; border-radius: 16px; border: 1px solid #f1f5f9;">
                  <img src="${it.image || '/assets/logo-icon.png'}" alt="" style="width: 52px; height: 64px; object-fit: cover; border-radius: 10px; background: #ffffff; border: 1px solid #e2e8f0;" />
                  <div style="flex: 1;">
                    <strong style="font-size: 14px; color: #0f172a; display: block;">${it.productNameAr || it.productName}</strong>
                    <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                      ${it.color ? `${it.color} • ` : ''}${it.size ? `${it.size} • ` : ''}الكمية: <strong>${it.quantity}</strong>
                    </div>
                  </div>
                  <span style="font-weight: 800; font-size: 15px; color: #0f172a;">${state.formatPrice(it.total || it.price * it.quantity)}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Address and Summary Card -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; line-height: 1.8; color: #475569;" class="form-row-2">
            <div>
              <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px;"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${state.t('shippingAddress')}:</div>
              <div><strong>${state.t('fullName')}:</strong> ${foundOrder.customerName}</div>
              <div><strong>${state.t('phone')}:</strong> ${foundOrder.customerPhone}</div>
              <div>${foundOrder.shippingAddress?.city || ''} - ${foundOrder.shippingAddress?.address || ''}</div>
            </div>

            <div style="text-align: ${lang === 'ar' ? 'left' : 'right'};">
              <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px;"><i class="fa-solid fa-credit-card" aria-hidden="true"></i> ${state.t('paymentMethod')}:</div>
              <div>${foundOrder.paymentMethod === 'cod' ? 'الدفع عند الاستلام كاش' : (foundOrder.paymentMethod === 'vodafone_cash' ? 'فودافون كاش / إنستاباي' : (foundOrder.paymentMethod?.toUpperCase() || 'دفع إلكتروني'))}</div>
              <div style="margin-top: 6px; font-size: 16px; font-weight: 800; color: #0f172a;">
                ${state.t('total')}: <span style="color: #0f172a;">${state.formatPrice(foundOrder.total)}</span>
              </div>
            </div>
          </div>

        </div>
      ` : (orderParam ? `
        <div class="m3-card-elevated" style="text-align: center; padding: 48px 24px; background: #ffffff; border: 2px dashed #cbd5e1; border-radius: 24px;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 16px;">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </div>
          <h3 style="font-size: 18px; font-weight: 800; color: #1e293b; margin-bottom: 6px;">
            ${lang === 'ar' ? `لم يتم العثور على طلب برقم "${orderParam}"` : `No order found for reference "${orderParam}"`}
          </h3>
          <p style="font-size: 13px; color: #64748b; max-width: 420px; margin: 0 auto 20px auto; line-height: 1.6;">
            ${lang === 'ar' 
              ? 'يرجى التأكد من كتابة الرقم كما ورد في رسالة التأكيد أو الفاتورة، أو التواصل مع خدمة عملاء المتجر للمساعدة الفورية.'
              : 'Please make sure you entered the exact reference code from your confirmation screen or invoice.'}
          </p>
          <a href="#shop" class="btn-m3-filled" style="display: inline-block; padding: 10px 24px; border-radius: 12px; background: #0f172a; color: #ffffff; font-weight: 700; font-size: 13px;">
            ${state.t('continueShopping')}
          </a>
        </div>
      ` : '')}

    </div>
  `;
}

function getStatusArabic(status: string): string {
  const map: Record<string, string> = {
    new: 'طلب جديد مسجل',
    confirmed: 'تم تأكيد الطلب',
    processing: 'قيد التجهيز والتغليف',
    shipped: 'خرج للتوصيل مع المندوب',
    delivered: 'تم التوصيل بنجاح',
    cancelled: 'ملغي ومسترجع'
  };
  return map[status] || status;
}

export function setupTrackEvents() {
  const form = document.getElementById('track-search-form') as HTMLFormElement;
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const val = (document.getElementById('track-order-input') as HTMLInputElement).value.trim();
      if (val) {
        window.location.hash = `track?order=${encodeURIComponent(val.toUpperCase())}`;
      }
    };
  }
}
